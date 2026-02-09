/**
 * Domain types for the database package.
 * These are portable interfaces that don't reference internal pnpm paths.
 */

export interface Trade {
  id: string;
  positionId: string;
  type: 'BUY' | 'SELL';
  amount: number;
  price: number;
  slippage: number;
  timestamp: Date;
  txSignature?: string | null;
  createdAt: Date;
}

export interface Position {
  id: string;
  token: string;
  amount: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
  status: 'OPEN' | 'CLOSED';
  pnl?: number | null;
  accountId?: string | null;
  openedAt: Date;
  closedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type PositionWithTrades = Position & { trades: Trade[] };

export type TradeWithPosition = Trade & { position: Position | null };

export interface TradeSettings {
  id: string;
  name: string;
  enabled: boolean;
  maxSlippage: number;
  maxPositions: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  minBurnAmount: number;
  createdAt: Date;
  updatedAt: Date;
}
