export interface Account {
  id: string;
  publicKey: string;
  balance: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  signature: string;
  type: 'BURN' | 'SWAP' | 'TRANSFER';
  amount: string;
  token: string;
  from: string;
  to: string;
  timestamp: string;
}

export interface Position {
  id: string;
  accountId: string;
  token: string;
  amount: string;
  entryPrice: string;
  currentPrice: string;
  pnl: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt?: string;
  stopLoss?: string;
  takeProfit?: string;
}

export interface Trade {
  id: string;
  positionId: string;
  type: 'BUY' | 'SELL';
  amount: string;
  price: string;
  signature: string;
  slippage: number;
  timestamp: string;
}

export interface BurnEventRecord {
  id: string;
  txSignature: string;
  token: string;
  amount: string;
  percentage: number;
  timestamp: string;
  processed: boolean;
}

export interface LiquidityPoolRecord {
  id: string;
  address: string;
  tokenA: string;
  tokenB: string;
  tvl: string;
  price: string;
  volume24h: string;
  updatedAt: string;
}

export interface WorkerStatusRecord {
  id: string;
  name: string;
  status: 'RUNNING' | 'STOPPED' | 'ERROR';
  lastSeen: string;
  metrics: Record<string, unknown>;
}

export interface TradeSettings {
  id: string;
  name: string;
  enabled: boolean;
  maxSlippage: number;
  maxPositions: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  minBurnAmount: number;
  updatedAt: string;
}
