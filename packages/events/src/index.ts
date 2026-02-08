import { z } from 'zod';
import type { DEXQuoteComparisonEvent, BurnDetectedEvent, LiquidityChangedEvent, TradeExecutedEvent, PositionOpenedEvent, PositionClosedEvent, WorkerStatusEvent, PriceUpdateEvent } from '@solana-eda/types';
import Redis from 'ioredis';

// Redis channel names
export const CHANNELS = {
  EVENTS_BURN: 'events:burn',
  EVENTS_LIQUIDITY: 'events:liquidity',
  EVENTS_TRADES: 'events:trades',
  EVENTS_POSITIONS: 'events:positions',
  EVENTS_DEX_COMPARISON: 'events:dex-comparison',
  EVENTS_PRICE: 'events:price',
  WORKERS_STATUS: 'workers:status',
  COMMANDS_TRADING: 'commands:trading',
  COMMANDS_WORKERS: 'commands:workers',
} as const;

// Event schemas for validation
export const BurnEventSchema = z.object({
  type: z.literal('BURN_DETECTED'),
  timestamp: z.string(),
  id: z.string(),
  data: z.object({
    token: z.string(),
    amount: z.string(),
    percentage: z.number(),
    txSignature: z.string(),
    burner: z.string(),
    preSupply: z.string(),
    postSupply: z.string(),
  }),
});

export const LiquidityEventSchema = z.object({
  type: z.literal('LIQUIDITY_CHANGED'),
  timestamp: z.string(),
  id: z.string(),
  data: z.object({
    poolAddress: z.string(),
    tokenA: z.string(),
    tokenB: z.string(),
    oldTvl: z.string(),
    newTvl: z.string(),
    price: z.string(),
    changePercentage: z.number(),
  }),
});

export const TradeEventSchema = z.object({
  type: z.literal('TRADE_EXECUTED'),
  timestamp: z.string(),
  id: z.string(),
  data: z.object({
    tradeId: z.string(),
    type: z.enum(['BUY', 'SELL']),
    tokenIn: z.string(),
    tokenOut: z.string(),
    amountIn: z.string(),
    amountOut: z.string(),
    price: z.string(),
    slippage: z.number(),
    txSignature: z.string(),
    positionId: z.string(),
  }),
});

export const PositionOpenedEventSchema = z.object({
  type: z.literal('POSITION_OPENED'),
  timestamp: z.string(),
  id: z.string(),
  data: z.object({
    positionId: z.string(),
    token: z.string(),
    amount: z.string(),
    entryPrice: z.string(),
    stopLoss: z.string().optional(),
    takeProfit: z.string().optional(),
  }),
});

export const PositionClosedEventSchema = z.object({
  type: z.literal('POSITION_CLOSED'),
  timestamp: z.string(),
  id: z.string(),
  data: z.object({
    positionId: z.string(),
    token: z.string(),
    exitPrice: z.string(),
    pnl: z.string(),
    pnlPercent: z.number(),
    holdDuration: z.number(),
    closeReason: z.enum(['TAKE_PROFIT', 'STOP_LOSS', 'MANUAL', 'TIMEOUT']),
  }),
});

export const WorkerStatusEventSchema = z.object({
  type: z.literal('WORKER_STATUS'),
  timestamp: z.string(),
  id: z.string(),
  data: z.object({
    workerName: z.string(),
    status: z.enum(['RUNNING', 'STOPPED', 'ERROR']),
    metrics: z.object({
      eventsProcessed: z.number(),
      errors: z.number(),
      uptime: z.number(),
      lastEventAt: z.string().optional(),
    }),
  }),
});

export const DEXQuoteComparisonEventSchema = z.object({
  type: z.literal('DEX_QUOTE_COMPARISON'),
  timestamp: z.string(),
  id: z.string(),
  data: z.object({
    inputMint: z.string(),
    outputMint: z.string(),
    amount: z.string(),
    quotes: z.array(
      z.object({
        dex: z.string(),
        outAmount: z.string(),
        priceImpactPct: z.number(),
      })
    ),
    selectedDEX: z.string(),
    bestQuote: z.object({
      dex: z.string(),
      outAmount: z.string(),
      priceImpactPct: z.number(),
    }),
  }),
});

export const PriceUpdateEventSchema = z.object({
  type: z.literal('PRICE_UPDATE'),
  timestamp: z.string(),
  id: z.string(),
  data: z.object({
    token: z.string(),
    price: z.string(),
    source: z.string(),
    confidence: z.number(),
    volume24h: z.string().optional(),
    priceChange24h: z.number().optional(),
    sources: z.array(
      z.object({
        dex: z.string(),
        price: z.string(),
        volume24h: z.string().optional(),
      })
    ),
  }),
});

// Combined event schema for validation
export const EventSchema = z.discriminatedUnion('type', [
  BurnEventSchema,
  LiquidityEventSchema,
  TradeEventSchema,
  PositionOpenedEventSchema,
  PositionClosedEventSchema,
  WorkerStatusEventSchema,
  DEXQuoteComparisonEventSchema,
  PriceUpdateEventSchema,
]);

// Type inference from schemas
export type EventUnion = z.infer<typeof EventSchema>;

// Type guards
export function isBurnEvent(event: EventUnion): event is BurnDetectedEvent {
  return event.type === 'BURN_DETECTED';
}

export function isLiquidityEvent(event: EventUnion): event is LiquidityChangedEvent {
  return event.type === 'LIQUIDITY_CHANGED';
}

export function isTradeEvent(event: EventUnion): event is TradeExecutedEvent {
  return event.type === 'TRADE_EXECUTED';
}

export function isPositionOpenedEvent(event: EventUnion): event is PositionOpenedEvent {
  return event.type === 'POSITION_OPENED';
}

export function isPositionClosedEvent(event: EventUnion): event is PositionClosedEvent {
  return event.type === 'POSITION_CLOSED';
}

export function isWorkerStatusEvent(event: EventUnion): event is WorkerStatusEvent {
  return event.type === 'WORKER_STATUS';
}

export function isDEXQuoteComparisonEvent(event: EventUnion): event is DEXQuoteComparisonEvent {
  return event.type === 'DEX_QUOTE_COMPARISON';
}

export function isPriceUpdateEvent(event: EventUnion): event is PriceUpdateEvent {
  return event.type === 'PRICE_UPDATE';
}

/**
 * Validate a Solana event
 */
export function validateEvent(data: unknown): EventUnion {
  return EventSchema.parse(data);
}

/**
 * Create a burn detected event
 */
export function createBurnEvent(data: z.infer<typeof BurnEventSchema>['data']): EventUnion {
  return {
    type: 'BURN_DETECTED',
    timestamp: new Date().toISOString(),
    id: `burn-${Date.now()}`,
    data,
  };
}

/**
 * Create a liquidity changed event
 */
export function createLiquidityEvent(data: z.infer<typeof LiquidityEventSchema>['data']): EventUnion {
  return {
    type: 'LIQUIDITY_CHANGED',
    timestamp: new Date().toISOString(),
    id: `liquidity-${Date.now()}`,
    data,
  };
}

/**
 * Create a trade executed event
 */
export function createTradeEvent(data: z.infer<typeof TradeEventSchema>['data']): EventUnion {
  return {
    type: 'TRADE_EXECUTED',
    timestamp: new Date().toISOString(),
    id: `trade-${Date.now()}`,
    data,
  };
}

/**
 * Create a position opened event
 */
export function createPositionOpenedEvent(data: z.infer<typeof PositionOpenedEventSchema>['data']): EventUnion {
  return {
    type: 'POSITION_OPENED',
    timestamp: new Date().toISOString(),
    id: `pos-open-${Date.now()}`,
    data,
  };
}

/**
 * Create a position closed event
 */
export function createPositionClosedEvent(data: z.infer<typeof PositionClosedEventSchema>['data']): EventUnion {
  return {
    type: 'POSITION_CLOSED',
    timestamp: new Date().toISOString(),
    id: `pos-close-${Date.now()}`,
    data,
  };
}

/**
 * Create a worker status event
 */
export function createWorkerStatusEvent(data: z.infer<typeof WorkerStatusEventSchema>['data']): EventUnion {
  return {
    type: 'WORKER_STATUS',
    timestamp: new Date().toISOString(),
    id: `worker-${Date.now()}`,
    data,
  };
}

/**
 * Create a DEX quote comparison event
 */
export function createDEXQuoteComparisonEvent(data: z.infer<typeof DEXQuoteComparisonEventSchema>['data']): EventUnion {
  return {
    type: 'DEX_QUOTE_COMPARISON',
    timestamp: new Date().toISOString(),
    id: `dex-comparison-${Date.now()}`,
    data,
  };
}

/**
 * Create a price update event
 */
export function createPriceUpdateEvent(data: z.infer<typeof PriceUpdateEventSchema>['data']): EventUnion {
  return {
    type: 'PRICE_UPDATE',
    timestamp: new Date().toISOString(),
    id: `price-update-${Date.now()}`,
    data,
  };
}

export { Redis as createClient };
