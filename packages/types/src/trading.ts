export interface StrategyConfig {
  enabled: boolean;
  maxSlippage: number;
  maxPositions: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  minBurnAmount: number;
  maxPositionSize: number;
}

// Position and Trade are now imported from database module to avoid conflicts

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: number;
  routePlan: RouteStep[];
}

export interface RouteStep {
  swapInfo: {
    ammKey: string;
    label: string;
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    feeAmount: string;
    feeMint: string;
  };
  percent: number;
}
