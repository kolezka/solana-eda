import { PublicKey } from '@solana/web3.js';

export type EventType =
  | 'BURN_DETECTED'
  | 'LIQUIDITY_CHANGED'
  | 'TRADE_EXECUTED'
  | 'POSITION_OPENED'
  | 'POSITION_CLOSED'
  | 'WORKER_STATUS'
  | 'DEX_QUOTE_COMPARISON'
  | 'PRICE_UPDATE';

export interface BaseEvent {
  type: EventType;
  timestamp: string;
  id: string;
}

export interface BurnDetectedEvent extends BaseEvent {
  type: 'BURN_DETECTED';
  data: {
    token: string;
    amount: string;
    percentage: number;
    txSignature: string;
    burner: string;
    preSupply: string;
    postSupply: string;
  };
}

export interface LiquidityChangedEvent extends BaseEvent {
  type: 'LIQUIDITY_CHANGED';
  data: {
    poolAddress: string;
    tokenA: string;
    tokenB: string;
    oldTvl: string;
    newTvl: string;
    price: string;
    changePercentage: number;
  };
}

export interface TradeExecutedEvent extends BaseEvent {
  type: 'TRADE_EXECUTED';
  data: {
    tradeId: string;
    type: 'BUY' | 'SELL';
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
    price: string;
    slippage: number;
    txSignature: string;
    positionId: string;
  };
}

export interface PositionOpenedEvent extends BaseEvent {
  type: 'POSITION_OPENED';
  data: {
    positionId: string;
    token: string;
    amount: string;
    entryPrice: string;
    stopLoss?: string;
    takeProfit?: string;
  };
}

export interface PositionClosedEvent extends BaseEvent {
  type: 'POSITION_CLOSED';
  data: {
    positionId: string;
    token: string;
    exitPrice: string;
    pnl: string;
    pnlPercent: number;
    holdDuration: number;
    closeReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL' | 'TIMEOUT';
  };
}

export interface WorkerStatusEvent extends BaseEvent {
  type: 'WORKER_STATUS';
  data: {
    workerName: string;
    status: 'RUNNING' | 'STOPPED' | 'ERROR';
    metrics: {
      eventsProcessed: number;
      errors: number;
      uptime: number;
      lastEventAt?: string;
    };
  };
}

export interface DEXQuoteComparisonEvent extends BaseEvent {
  type: 'DEX_QUOTE_COMPARISON';
  data: {
    inputMint: string;
    outputMint: string;
    amount: string;
    quotes: {
      dex: string;
      outAmount: string;
      priceImpactPct: number;
    }[];
    selectedDEX: string;
    bestQuote: {
      dex: string;
      outAmount: string;
      priceImpactPct: number;
    };
  };
}

export interface PriceUpdateEvent extends BaseEvent {
  type: 'PRICE_UPDATE';
  data: {
    token: string;
    price: string;
    source: string;
    confidence: number;
    volume24h?: string;
    priceChange24h?: number;
    sources: {
      dex: string;
      price: string;
      volume24h?: string;
    }[];
  };
}

export type AnyEvent =
  | BurnDetectedEvent
  | LiquidityChangedEvent
  | TradeExecutedEvent
  | PositionOpenedEvent
  | PositionClosedEvent
  | WorkerStatusEvent
  | DEXQuoteComparisonEvent
  | PriceUpdateEvent;
