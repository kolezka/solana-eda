import { Connection, Keypair, PublicKey, Transaction, TransactionInstruction, VersionedTransaction } from '@solana/web3.js';
import type { QuoteResponse, QuoteGetRequest, SwapRequest, SwapResponse } from '@jup-ag/api';
import type { DEXClient, DEXQuote, DEXSwapResult, SwapExecutionOptions } from './types';
import { PriorityFeeManager } from './priority-fee-manager';

/**
 * Jupiter DEX Client
 * Uses Jupiter V6 REST API for quotes and swap transactions
 */
export class JupiterClient implements DEXClient {
  name = 'Jupiter';

  private apiUrl: string;
  private priorityFeeManager: PriorityFeeManager;

  constructor(
    private connection: Connection,
    private wallet: Keypair,
    apiUrl: string = 'https://quote-api.jup.ag/v6',
  ) {
    this.apiUrl = apiUrl;
    this.priorityFeeManager = new PriorityFeeManager();
  }

  async getQuote(inputMint: string, outputMint: string, amount: string): Promise<DEXQuote> {
    try {
      // Use fetch to call Jupiter's quote API
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
        throw new Error(`Jupiter quote API error: ${response.statusText}`);
      }

      const quoteResponse = (await response.json()) as QuoteResponse;

      // Convert route plan to our format
      const routePlan =
        quoteResponse.routePlan?.map((step) => ({
          dex: step.swapInfo?.label || 'Unknown',
          inputMint: step.swapInfo?.inputMint || inputMint,
          outputMint: step.swapInfo?.outputMint || outputMint,
          percent: step.percent || 100,
        })) || [];

      const priceImpact = quoteResponse.priceImpactPct;
      const priceImpactPct = typeof priceImpact === 'number' ? priceImpact / 100 : 0;

      return {
        inputMint,
        outputMint,
        inAmount: amount,
        outAmount: quoteResponse.outAmount,
        priceImpactPct,
        routePlan,
      };
    } catch (error) {
      console.error('[JupiterClient] Error getting quote:', error);
      throw error;
    }
  }

  async executeSwap(
    quote: DEXQuote,
    maxSlippageBps: number = 50,
    options?: SwapExecutionOptions,
  ): Promise<DEXSwapResult> {
    try {
      const swapRequest: SwapRequest = {
        quoteResponse: {
          inputMint: quote.inputMint,
          inAmount: quote.inAmount,
          outputMint: quote.outputMint,
          outAmount: quote.outAmount,
          otherAmountThreshold: quote.outAmount,
          swapMode: 'ExactIn',
          slippageBps: maxSlippageBps,
          priceImpactPct: String(quote.priceImpactPct * 100),
          routePlan:
            quote.routePlan?.map((step) => ({
              swapInfo: {
                ammKey: step.dex,
                label: step.dex,
                inputMint: step.inputMint,
                outputMint: step.outputMint,
                notEnoughLiquidity: false,
                inAmount: quote.inAmount,
                outAmount: quote.outAmount,
                feeAmount: '0',
                feeMint: quote.inputMint,
                priceImpactPct: String(quote.priceImpactPct * 100),
              },
              percent: step.percent,
            })) || [],
        },
        userPublicKey: this.wallet.publicKey.toBase58(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: options?.priorityFee !== undefined
          ? ({ prioritizationFeeLamports: Number(options.priorityFee) } as any)
          : undefined,
        // computeUnitLimit is not part of SwapRequest type, adding as extension
        ...(options?.computeUnits ? { computeUnitLimit: options.computeUnits } as any : {}),
      };

      // Use fetch to call Jupiter's swap API
      const response = await fetch(`${this.apiUrl}/swap`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(swapRequest),
      });

      if (!response.ok) {
        throw new Error(`Jupiter swap API error: ${response.statusText}`);
      }

      const swapResponse = (await response.json()) as SwapResponse & {
        success?: boolean;
        error?: string;
        swapTransaction?: string;
      };

      if (swapResponse.success === false) {
        throw new Error(`Swap failed: ${swapResponse.error || 'Unknown error'}`);
      }

      if (!swapResponse.swapTransaction) {
        throw new Error('No swap transaction in response');
      }

      // Deserialize and sign the transaction
      const swapTransactionBuf = Buffer.from(swapResponse.swapTransaction, 'base64');
      let transaction = VersionedTransaction.deserialize(swapTransactionBuf);

      // If priority fee was not set by Jupiter, add it manually
      if (options?.priorityFee && !swapRequest.prioritizationFeeLamports) {
        // For VersionedTransaction, we need to add ComputeBudget instructions
        // This is a simplified approach - production code should handle this more carefully
        console.warn(
          '[JupiterClient] Manual priority fee addition for VersionedTransaction not fully implemented',
        );
      }

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
      console.error('[JupiterClient] Error executing swap:', error);

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

export type JupiterQuote = DEXQuote;
