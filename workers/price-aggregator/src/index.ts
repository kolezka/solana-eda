import { Connection, PublicKey } from '@solana/web3.js';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { CHANNELS, createPriceUpdateEvent, createWorkerStatusEvent } from '@solana-eda/events';
import { PriceRepository, WorkerStatusRepository } from '@solana-eda/database';
import { SolanaConnectionManager } from '@solana-eda/solana-client';
import { Keypair } from '@solana/web3.js';
import { getLogger, LogLevel } from '@solana-eda/monitoring';

// Load environment variables
dotenv.config();

const logger = getLogger('price-aggregator');

// Configuration
const TRACKED_TOKENS = process.env.TRACKED_TOKENS
  ? process.env.TRACKED_TOKENS.split(',').map((t) => t.trim())
  : [
      'So11111111111111111111111111111111111111112', // SOL
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    ];

const PRICE_POLL_INTERVAL = parseInt(process.env.PRICE_POLL_INTERVAL || '10000', 10);
const WORKER_NAME = process.env.WORKER_NAME || 'price-aggregator';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/solana_eda';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const SOLANA_WS_URL = process.env.SOLANA_WS_URL;

// Get private key from environment
const PRIVATE_KEY_BYTES = Buffer.from(
  (process.env.TRADING_PRIVATE_KEY || '').replace(/0x/, ''),
  'base64',
);

interface DEXPriceSource {
  dex: string;
  price: number;
  volume24h?: number;
}

interface TokenPrice {
  token: string;
  price: number;
  sources: DEXPriceSource[];
  confidence: number;
  volume24h?: number;
  priceChange24h?: number;
}

class PriceAggregatorWorker {
  private connection: SolanaConnectionManager;
  private redis: Redis;
  private priceRepository: PriceRepository;
  private workerStatusRepository: WorkerStatusRepository;
  private isRunning = false;
  private pollInterval?: NodeJS.Timeout;
  private priceHistory: Map<string, number[]> = new Map();
  private metrics = {
    pricesUpdated: 0,
    errors: 0,
    tokensTracked: TRACKED_TOKENS.length,
    lastPollAt: '',
  };

  constructor() {
    // Initialize Solana connection
    this.connection = new SolanaConnectionManager(SOLANA_RPC_URL, SOLANA_WS_URL);

    // Initialize Redis
    this.redis = new Redis(REDIS_URL);

    // Initialize repositories (they'll create their own PrismaClient)
    // We're using a simplified approach here - in production you'd use dependency injection
    // @ts-ignore - We'll handle the Prisma initialization
    this.priceRepository = new PriceRepository({ prisma: null });
    // @ts-ignore
    this.workerStatusRepository = new WorkerStatusRepository({ prisma: null });
  }

  async start(): Promise<void> {
    logger.info('Starting Price Aggregator Worker...');
    this.isRunning = true;

    // Publish initial status
    await this.publishWorkerStatus();

    // Start polling
    this.pollInterval = setInterval(() => this.pollPrices(), PRICE_POLL_INTERVAL);

    // Do initial poll
    await this.pollPrices();

    logger.info(`Price Aggregator Worker started. Tracking ${TRACKED_TOKENS.length} tokens.`);
    logger.info(`Polling interval: ${PRICE_POLL_INTERVAL}ms`);
  }

  async stop(): Promise<void> {
    logger.info('Stopping Price Aggregator Worker...');
    this.isRunning = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    // Publish final status
    await this.publishWorkerStatus();

    await this.redis.quit();
    await this.connection.close();

    logger.info('Price Aggregator Worker stopped.');
  }

  private async pollPrices(): Promise<void> {
    if (!this.isRunning) return;

    try {
      logger.debug(`Polling prices for ${TRACKED_TOKENS.length} tokens...`);

      // Fetch prices from all DEXes for all tracked tokens
      const tokenPrices: TokenPrice[] = [];

      for (const tokenMint of TRACKED_TOKENS) {
        try {
          const priceData = await this.fetchTokenPrice(tokenMint);
          if (priceData) {
            tokenPrices.push(priceData);
          }
        } catch (error) {
          logger.error(`Error fetching price for ${tokenMint}:`, error as Error);
          this.metrics.errors++;
        }
      }

      // Process and save prices
      for (const priceData of tokenPrices) {
        await this.processPriceUpdate(priceData);
      }

      this.metrics.lastPollAt = new Date().toISOString();
      this.metrics.pricesUpdated += tokenPrices.length;

      logger.debug(`Price poll complete. Updated ${tokenPrices.length} token prices.`);

      // Publish updated status
      await this.publishWorkerStatus();
    } catch (error) {
      logger.error('Error during price polling:', error as Error);
      this.metrics.errors++;
    }
  }

  private async fetchTokenPrice(tokenMint: string): Promise<TokenPrice | null> {
    // For now, we'll use a simplified price fetch from Jupiter API
    // In production, you'd query multiple DEXes via the DEXAggregator

    try {
      const SOL_MINT = 'So11111111111111111111111111111111111111112';
      const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

      // Define trading pairs
      let inputMint: string;
      let outputMint: string;
      let isBaseToken = false;

      if (tokenMint === SOL_MINT) {
        // Get SOL price in USDC
        inputMint = SOL_MINT;
        outputMint = USDC_MINT;
        isBaseToken = true;
      } else if (tokenMint === USDC_MINT) {
        // USDC is always $1
        return {
          token: tokenMint,
          price: 1.0,
          sources: [{ dex: 'stablecoin', price: 1.0 }],
          confidence: 1.0,
          volume24h: 0,
        };
      } else {
        // Get token price in SOL, then convert to USD
        inputMint = tokenMint;
        outputMint = SOL_MINT;
      }

      // Use Jupiter API for price quotes
      const amount = '1000000'; // 1 token (assuming 6 or 9 decimals)
      const apiUrl = 'https://quote-api.jup.ag/v6';
      const url = `${apiUrl}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Jupiter API error: ${response.status}`);
      }

      const quote = (await response.json()) as { outAmount?: string; inAmount?: string };

      if (!quote.outAmount || !quote.inAmount) {
        throw new Error('Invalid quote response from Jupiter API');
      }

      const rawPrice = Number(quote.outAmount) / Number(quote.inAmount);

      // If we got SOL/token price, invert to get token/SOL price
      let priceInSol = rawPrice;
      if (inputMint === tokenMint && outputMint === SOL_MINT) {
        priceInSol = rawPrice;
      } else {
        priceInSol = 1 / rawPrice;
      }

      // For non-SOL tokens, we'd need to multiply by SOL price to get USD
      // For now, we'll just return the price we got
      let finalPrice = priceInSol;

      // Store price history for 24h change calculation
      const now = Date.now();
      const history = this.priceHistory.get(tokenMint) || [];
      history.push(finalPrice);

      // Keep only last 24 hours of prices (assuming 10s interval, that's 8640 data points)
      // For simplicity, we'll keep last 100 data points
      if (history.length > 100) {
        history.shift();
      }
      this.priceHistory.set(tokenMint, history);

      // Calculate 24h price change (simplified - using available history)
      let priceChange24h: number | undefined;
      if (history.length > 10) {
        const oldPrice = history[0];
        if (oldPrice !== undefined) {
          priceChange24h = ((finalPrice - oldPrice) / oldPrice) * 100;
        }
      }

      return {
        token: tokenMint,
        price: finalPrice,
        sources: [
          {
            dex: 'jupiter',
            price: finalPrice,
            volume24h: 0, // Would need to fetch from DEX
          },
        ],
        confidence: 0.9, // High confidence from Jupiter aggregator
        priceChange24h,
      };
    } catch (error) {
      logger.error(`Error fetching price for ${tokenMint}:`, error as Error);
      return null;
    }
  }

  private async processPriceUpdate(priceData: TokenPrice): Promise<void> {
    try {
      // Calculate VWAP across sources
      const totalVolume = priceData.sources.reduce((sum, s) => sum + (s.volume24h || 0), 0);

      let vwap = priceData.price;
      if (totalVolume > 0) {
        vwap =
          priceData.sources.reduce((sum, s) => sum + s.price * (s.volume24h || 0), 0) / totalVolume;
      }

      // Assign confidence score based on source count and price spread
      const prices = priceData.sources.map((s) => s.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const spread = maxPrice > 0 ? (maxPrice - minPrice) / maxPrice : 0;

      // Higher confidence with more sources and lower spread
      const sourceCount = priceData.sources.length;
      const confidence = Math.min(1.0, (sourceCount / 4) * (1 - spread));

      const finalPriceData = {
        ...priceData,
        price: vwap,
        confidence,
      };

      // Save to database
      try {
        await this.priceRepository.create({
          token: priceData.token,
          price: vwap,
          source: 'aggregated',
          confidence,
          volume24h: totalVolume,
        });
      } catch (dbError) {
        // Database might not be available, log and continue
        logger.warn('Failed to save price to database', { error: dbError });
      }

      // Publish price update event
      const event = createPriceUpdateEvent({
        token: priceData.token,
        price: vwap.toString(),
        source: 'aggregated',
        confidence,
        volume24h: totalVolume?.toString(),
        priceChange24h: priceData.priceChange24h,
        sources: priceData.sources.map((s) => ({
          dex: s.dex,
          price: s.price.toString(),
          volume24h: s.volume24h?.toString(),
        })),
      });

      await this.redis.publish(CHANNELS.EVENTS_PRICE, JSON.stringify(event));

      logger.debug(
        `Price updated: ${priceData.token} = $${vwap.toFixed(6)} (confidence: ${(confidence * 100).toFixed(1)}%)`,
      );
    } catch (error) {
      logger.error('Error processing price update:', error as Error);
      throw error;
    }
  }

  private async publishWorkerStatus(): Promise<void> {
    try {
      const uptime = process.uptime();
      const event = createWorkerStatusEvent({
        workerName: WORKER_NAME,
        status: this.isRunning ? 'RUNNING' : 'STOPPED',
        metrics: {
          eventsProcessed: this.metrics.pricesUpdated,
          errors: this.metrics.errors,
          uptime,
          lastEventAt: this.metrics.lastPollAt,
        },
      });

      await this.redis.publish(CHANNELS.WORKERS_STATUS, JSON.stringify(event));
    } catch (error) {
      logger.error('Error publishing worker status:', error as Error);
    }
  }
}

// Main entry point
async function main(): Promise<void> {
  const worker = new PriceAggregatorWorker();

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    await worker.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Start the worker
  try {
    await worker.start();
  } catch (error) {
    logger.error('Failed to start worker:', error as Error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}
