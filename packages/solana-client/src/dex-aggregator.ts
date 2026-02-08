import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import Redis from 'ioredis';
import type { DEXClient, BestQuote, SwapResult } from './types';
import { JupiterClient } from './jupiter-client';
import { OrcaClient } from './orca-client';
import { RaydiumClient } from './raydium-client';
import { MeteoraClient } from './meteora-client';

/**
 * DEX Aggregator
 * Aggregates quotes from multiple DEXes and routes swaps to the best option
 */
export class DEXAggregator {
  private clients: Map<string, DEXClient>;
  private enabledDEXes: Set<string>;
  private redis: Redis;

  constructor(
    private connection: Connection,
    private wallet: Keypair,
    private redisUrl: string,
    config?: {
      enabledDEXes?: string[];
      jupiterApiUrl?: string;
    }
  ) {
    this.redis = new Redis(redisUrl);
    this.clients = new Map();
    this.enabledDEXes = new Set(config?.enabledDEXes || ['jupiter', 'orca', 'meteora', 'raydium']);

    const jupiterApi = config?.jupiterApiUrl || 'https://quote-api.jup.ag/v6';

    // Initialize real DEX clients
    try {
      this.clients.set('jupiter', new JupiterClient(connection, wallet, jupiterApi));
      this.clients.set('orca', new OrcaClient(connection, wallet, jupiterApi));
      this.clients.set('raydium', new RaydiumClient(connection, wallet, jupiterApi));
      this.clients.set('meteora', new MeteoraClient(connection, wallet, jupiterApi));
    } catch (error) {
      console.error('[DEXAggregator] Error initializing DEX clients:', error);
    }

    console.log(`[DEXAggregator] Initialized with DEXes: ${Array.from(this.enabledDEXes).join(', ')}`);
    console.log(`[DEXAggregator] Available clients: ${Array.from(this.clients.keys()).join(', ')}`);
  }

  /**
   * Get the best quote from all enabled DEXes
   */
  async getBestQuote(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: bigint
  ): Promise<BestQuote> {
    const quotes: Array<{
      dex: string;
      quote: BestQuote;
      outAmount: bigint;
      priceImpactPct: number;
    }> = [];

    const quotePromises = Array.from(this.enabledDEXes).map(async (dex) => {
      const client = this.clients.get(dex);
      if (!client) {
        console.warn(`[DEXAggregator] Client not found for DEX: ${dex}`);
        return null;
      }

      try {
        const quote = await client.getQuote(
          inputMint.toString(),
          outputMint.toString(),
          amount.toString()
        );

        return {
          dex,
          quote: {
            ...quote,
            dex,
          },
          outAmount: BigInt(quote.outAmount),
          priceImpactPct: quote.priceImpactPct,
        };
      } catch (error) {
        console.error(`[DEXAggregator] Error getting quote from ${dex}:`, error);
        return null;
      }
    });

    const results = await Promise.allSettled(quotePromises);

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        quotes.push(result.value);
      }
    }

    if (quotes.length === 0) {
      throw new Error('No quotes available from any enabled DEX');
    }

    // Sort by output amount (descending) to get the best quote
    quotes.sort((a, b) => {
      const diff = b.outAmount - a.outAmount;
      // Handle BigInt comparison safely
      if (diff > 0n) return 1;
      if (diff < 0n) return -1;
      return 0;
    });

    const best = quotes[0];
    if (!best) {
      throw new Error('No best quote found');
    }

    // Publish DEX quote comparison event
    await this.publishDEXComparisonEvent(
      inputMint.toString(),
      outputMint.toString(),
      amount.toString(),
      quotes,
      best.dex
    );

    return best.quote;
  }

  /**
   * Execute a swap using the best quote
   */
  async executeBestSwap(
    bestQuote: BestQuote,
    maxSlippageBps: number = 50
  ): Promise<SwapResult> {
    const dex = bestQuote.dex;
    console.log(`[DEXAggregator] Executing swap on ${dex}...`);

    const client = this.clients.get(dex);

    if (!client) {
      throw new Error(`No client found for DEX: ${dex}`);
    }

    try {
      const result = await client.executeSwap(bestQuote, maxSlippageBps);

      return {
        ...result,
        dex,
      };
    } catch (error) {
      console.error(`[DEXAggregator] Error executing swap on ${dex}:`, error);

      return {
        dex,
        signature: null,
        success: false,
        amountOut: '0',
        actualSlippage: maxSlippageBps / 100,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get all quotes from enabled DEXes
   */
  async getAllQuotes(
    inputMint: PublicKey,
    outputMint: PublicKey,
    amount: bigint
  ): Promise<Array<{ dex: string; quote: BestQuote }>> {
    const quotes: Array<{ dex: string; quote: BestQuote }> = [];

    const quotePromises = Array.from(this.enabledDEXes).map(async (dex) => {
      const client = this.clients.get(dex);
      if (!client) {
        return null;
      }

      try {
        const quote = await client.getQuote(
          inputMint.toString(),
          outputMint.toString(),
          amount.toString()
        );

        return {
          dex,
          quote: {
            ...quote,
            dex,
          },
        };
      } catch (error) {
        console.error(`[DEXAggregator] Error getting quote from ${dex}:`, error);
        return null;
      }
    });

    const results = await Promise.allSettled(quotePromises);

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        quotes.push(result.value);
      }
    }

    return quotes;
  }

  /**
   * Set which DEXes are enabled for trading
   */
  setEnabledDEXes(dexes: string[]) {
    this.enabledDEXes = new Set(dexes);
    console.log(`[DEXAggregator] Enabled DEXes: ${Array.from(this.enabledDEXes).join(', ')}`);
  }

  /**
   * Get the list of enabled DEXes
   */
  getEnabledDEXes(): string[] {
    return Array.from(this.enabledDEXes);
  }

  /**
   * Get the list of available DEX clients
   */
  getAvailableDEXes(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Publish a DEX quote comparison event to Redis
   */
  private async publishDEXComparisonEvent(
    inputMint: string,
    outputMint: string,
    amount: string,
    quotes: Array<{
      dex: string;
      quote: BestQuote;
      outAmount: bigint;
      priceImpactPct: number;
    }>,
    selectedDEX: string
  ) {
    try {
      // Publish event to Redis channel
      const eventData = {
        type: 'DEX_QUOTE_COMPARISON',
        timestamp: new Date().toISOString(),
        id: `dex-comparison-${Date.now()}`,
        data: {
          inputMint,
          outputMint,
          amount,
          quotes: quotes.map((q) => ({
            dex: q.dex,
            outAmount: q.outAmount.toString(),
            priceImpactPct: q.priceImpactPct,
          })),
          selectedDEX,
          bestQuote: {
            dex: selectedDEX,
            outAmount: quotes.find((q) => q.dex === selectedDEX)?.outAmount.toString() || '0',
            priceImpactPct: quotes.find((q) => q.dex === selectedDEX)?.priceImpactPct || 0,
          },
        },
      };

      await this.redis.publish('events:dex-comparison', JSON.stringify(eventData));
    } catch (error) {
      console.error('[DEXAggregator] Error publishing DEX comparison event:', error);
    }
  }

  /**
   * Close the aggregator and clean up resources
   */
  async close() {
    await this.redis.quit();
  }
}
