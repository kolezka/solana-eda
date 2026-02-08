import { Connection, Keypair, PublicKey, VersionedTransaction } from '@solana/web3.js';
import type { DEXClient, DEXQuote, DEXSwapResult } from './types';

interface QuoteResponse {
  outAmount: string;
  priceImpactPct?: number;
  routePlan?: Array<{
    swapInfo?: {
      label?: string;
      inputMint?: string;
      outputMint?: string;
    };
  }>;
}

interface SwapResponse {
  success?: boolean;
  error?: string;
  swapTransaction?: string;
}

/**
 * Raydium DEX Client
 * Note: Raydium SDK V2 integration requires specific setup.
 * This client provides a fallback to Jupiter API with Raydium routing.
 */
export class RaydiumClient implements DEXClient {
  name = 'Raydium';

  private apiUrl: string;

  // Raydium program IDs
  private static readonly RAYDIUM_PROGRAM_ID = '675kPX9MHTjSvztHMAhRV2QfWRkK3F';

  constructor(
    private connection: Connection,
    private wallet: Keypair,
    apiUrl: string = 'https://quote-api.jup.ag/v6'
  ) {
    this.apiUrl = apiUrl;
  }

  /**
   * Get a quote using Jupiter API with Raydium routing
   */
  async getQuote(
    inputMint: string,
    outputMint: string,
    amount: string
  ): Promise<DEXQuote> {
    try {
      // Use Jupiter API to get quotes
      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount,
        slippageBps: '50',
        onlyDirectRoutes: 'false',
        asLegacyTransaction: 'false',
      });

      const response = await fetch(`${this.apiUrl}/quote?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Quote API error: ${response.statusText}`);
      }

      const quoteResponse = await response.json() as QuoteResponse;

      // Check if route uses Raydium
      const hasRaydiumRoute = quoteResponse.routePlan?.some((step) =>
        step.swapInfo?.label?.toLowerCase().includes('raydium')
      );

      if (!hasRaydiumRoute) {
        console.warn('[RaydiumClient] No Raydium route found, returning best available quote');
      }

      const priceImpact = quoteResponse.priceImpactPct;
      const priceImpactPct = typeof priceImpact === 'number' ? priceImpact / 100 : 0;

      return {
        inputMint,
        outputMint,
        inAmount: amount,
        outAmount: quoteResponse.outAmount,
        priceImpactPct,
        routePlan: [{
          dex: 'Raydium',
          inputMint,
          outputMint,
          percent: 100,
        }],
      };
    } catch (error) {
      console.error('[RaydiumClient] Error getting quote:', error);
      throw error;
    }
  }

  /**
   * Execute a swap using Jupiter API (which will route through Raydium if available)
   */
  async executeSwap(
    quote: DEXQuote,
    maxSlippageBps: number = 50
  ): Promise<DEXSwapResult> {
    try {
      const swapRequest = {
        quoteResponse: {
          inputMint: quote.inputMint,
          inAmount: quote.inAmount,
          outputMint: quote.outputMint,
          outAmount: quote.outAmount,
          otherAmountThreshold: quote.outAmount,
          swapMode: 'ExactIn',
          slippageBps: maxSlippageBps,
          priceImpactPct: quote.priceImpactPct * 100,
        },
        userPublicKey: this.wallet.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
      };

      const response = await fetch(`${this.apiUrl}/swap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(swapRequest),
      });

      if (!response.ok) {
        throw new Error(`Swap API error: ${response.statusText}`);
      }

      const swapResponse = await response.json() as SwapResponse;

      if (swapResponse.success === false) {
        throw new Error(`Swap failed: ${swapResponse.error || 'Unknown error'}`);
      }

      if (!swapResponse.swapTransaction) {
        throw new Error('No swap transaction in response');
      }

      // Deserialize and sign the transaction
      const swapTransactionBuf = Buffer.from(swapResponse.swapTransaction, 'base64');
      const transaction = VersionedTransaction.deserialize(swapTransactionBuf);

      transaction.sign([this.wallet]);

      // Send transaction
      const signature = await this.connection.sendTransaction(transaction, {
        skipPreflight: false,
        maxRetries: 3,
      });

      // Wait for confirmation
      const confirmation = await this.connection.confirmTransaction(signature, 'confirmed');

      const success = !confirmation.value.err;

      return {
        signature: success ? signature : null,
        success,
        amountOut: success ? quote.outAmount : '0',
        actualSlippage: success ? 0 : maxSlippageBps / 100,
        error: !success ? 'Transaction failed' : undefined,
      };
    } catch (error) {
      console.error('[RaydiumClient] Error executing swap:', error);

      return {
        signature: null,
        success: false,
        amountOut: '0',
        actualSlippage: maxSlippageBps / 100,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export type RaydiumQuote = DEXQuote;
