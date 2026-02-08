import { Connection, Keypair, PublicKey, VersionedTransaction, Transaction } from '@solana/web3.js';
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
 * Orca DEX Client
 * Note: Orca Whirlpools SDK integration requires specific setup.
 * This client provides a fallback to Jupiter API with Orca routing.
 */
export class OrcaClient implements DEXClient {
  name = 'Orca';

  private apiUrl: string;

  // Orca program IDs
  private static readonly ORCA_PROGRAM_ID = 'whirLbBCjQxwqx3qiuYsmkL7y2rFqg9J';

  constructor(
    private connection: Connection,
    private wallet: Keypair,
    apiUrl: string = 'https://quote-api.jup.ag/v6',
  ) {
    this.apiUrl = apiUrl;
  }

  /**
   * Get a quote using Jupiter API with Orca-only routing
   */
  async getQuote(inputMint: string, outputMint: string, amount: string): Promise<DEXQuote> {
    try {
      // Use Jupiter API to get quotes, filtered to Orca pools only
      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount,
        slippageBps: '50',
        onlyDirectRoutes: 'false',
        asLegacyTransaction: 'false',
        // Try to prefer Orca pools
        restrictIntermediateTokens: 'false',
      });

      const response = await fetch(`${this.apiUrl}/quote?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Quote API error: ${response.statusText}`);
      }

      const quoteResponse = (await response.json()) as QuoteResponse;

      // Check if route uses Orca
      const hasOrcaRoute = quoteResponse.routePlan?.some((step) =>
        step.swapInfo?.label?.toLowerCase().includes('orca'),
      );

      if (!hasOrcaRoute) {
        console.warn('[OrcaClient] No Orca route found, returning best available quote');
      }

      const priceImpact = quoteResponse.priceImpactPct;
      const priceImpactPct = typeof priceImpact === 'number' ? priceImpact / 100 : 0;

      return {
        inputMint,
        outputMint,
        inAmount: amount,
        outAmount: quoteResponse.outAmount,
        priceImpactPct,
        routePlan: [
          {
            dex: 'Orca',
            inputMint,
            outputMint,
            percent: 100,
          },
        ],
      };
    } catch (error) {
      console.error('[OrcaClient] Error getting quote:', error);
      throw error;
    }
  }

  /**
   * Execute a swap using Jupiter API (which will route through Orca if available)
   */
  async executeSwap(quote: DEXQuote, maxSlippageBps: number = 50): Promise<DEXSwapResult> {
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

      const swapResponse = (await response.json()) as SwapResponse;

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
      console.error('[OrcaClient] Error executing swap:', error);

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

export type OrcaQuote = DEXQuote;
