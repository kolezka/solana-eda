/**
 * DEX Quote interface
 * Represents a price quote from a DEX for a token swap
 */
export interface DEXQuote {
  /** Input token mint address */
  inputMint: string;
  /** Output token mint address */
  outputMint: string;
  /** Amount of input tokens (in smallest unit) */
  inAmount: string;
  /** Expected amount of output tokens (in smallest unit) */
  outAmount: string;
  /** Price impact as a percentage (e.g., 0.5 for 0.5%) */
  priceImpactPct: number;
  /** Optional route plan for complex swaps */
  routePlan?: RouteStep[];
}

/**
 * Route step for multi-hop swaps
 */
export interface RouteStep {
  /** DEX name for this step */
  dex: string;
  /** Input token for this step */
  inputMint: string;
  /** Output token for this step */
  outputMint: string;
  /** Percentage of total input to route through this step */
  percent: number;
}

/**
 * DEX Swap Result interface
 * Represents the result of executing a swap on a DEX
 */
export interface DEXSwapResult {
  /** Transaction signature (null if failed) */
  signature: string | null;
  /** Whether the swap succeeded */
  success: boolean;
  /** Actual amount received (in smallest unit) */
  amountOut: string;
  /** Actual slippage experienced as a percentage */
  actualSlippage: number;
  /** Error message if swap failed */
  error?: string;
}

/**
 * Best Quote interface
 * Extends DEXQuote with the DEX name that provided the quote
 */
export interface BestQuote extends DEXQuote {
  /** Name of the DEX providing this quote */
  dex: string;
  /** Accounts involved in the swap (for priority fee calculation) */
  accountsInvolved?: string[];
}

/**
 * Swap Result interface
 * Extends DEXSwapResult with the DEX name where the swap was executed
 */
export interface SwapResult extends DEXSwapResult {
  /** Name of the DEX where the swap was executed */
  dex: string;
}

/**
 * Options for swap execution
 */
export interface SwapExecutionOptions {
  /** Priority fee in micro-lamports for transaction processing */
  priorityFee?: number;
  /** Compute unit limit for the transaction */
  computeUnits?: number;
}

/**
 * DEX Client interface
 * Interface that all DEX clients must implement
 */
export interface DEXClient {
  /** Name of the DEX */
  name: string;

  /**
   * Get a quote for a token swap
   * @param inputMint Input token mint address
   * @param outputMint Output token mint address
   * @param amount Amount of input tokens (in smallest unit)
   * @returns Promise<DEXQuote> Quote information
   */
  getQuote(inputMint: string, outputMint: string, amount: string): Promise<DEXQuote>;

  /**
   * Execute a swap on this DEX
   * @param quote The quote to execute
   * @param maxSlippageBps Maximum slippage in basis points (e.g., 50 for 0.5%)
   * @param options Optional execution parameters (priority fees, compute units)
   * @returns Promise<DEXSwapResult> Swap execution result
   */
  executeSwap(
    quote: DEXQuote,
    maxSlippageBps?: number,
    options?: SwapExecutionOptions,
  ): Promise<DEXSwapResult>;
}
