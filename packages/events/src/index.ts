import { z } from 'zod';
import type {
  DEXQuoteComparisonEvent,
  BurnDetectedEvent,
  LiquidityChangedEvent,
  TradeExecutedEvent,
  PositionOpenedEvent,
  PositionClosedEvent,
  WorkerStatusEvent,
  PriceUpdateEvent,
  MarketDiscoveredEvent,
  TokenValidatedEvent,
  PoolDiscoveredEvent,
} from '@solana-eda/types';
import Redis from 'ioredis';

export { Redis as createClient };

// Redis channel names
export const CHANNELS = {
  EVENTS_BURN: 'events:burn',
  EVENTS_LIQUIDITY: 'events:liquidity',
  EVENTS_TRADES: 'events:trades',
  EVENTS_POSITIONS: 'events:positions',
  EVENTS_DEX_COMPARISON: 'events:dex-comparison',
  EVENTS_PRICE: 'events:price',
  EVENTS_MARKETS: 'events:markets',
  EVENTS_TOKENS: 'events:tokens',
  EVENTS_POOLS: 'events:pools',
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
      }),
    ),
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
      }),
    ),
    selectedDEX: z.string(),
    bestQuote: z.object({
      dex: z.string(),
      outAmount: z.string(),
      priceImpactPct: z.number(),
    }),
  }),
});

export const MarketDiscoveredEventSchema = z.object({
  type: z.literal('MARKET_DISCOVERED'),
  timestamp: z.string(),
  id: z.string(),
  data: z.object({
    marketAddress: z.string(),
    baseMint: z.string(),
    quoteMint: z.string(),
    dexType: z.enum(['OPENBOOK', 'RAYDIUM', 'ORCA', 'METEORA']),
    discoveredAt: z.string(),
    source: z.string(),
    marketData: z
      .object({
        name: z.string().optional(),
        minOrderSize: z.string().optional(),
        tickSize: z.string().optional(),
      })
      .optional(),
  }),
});

export const TokenValidatedEventSchema = z.object({
  type: z.literal('TOKEN_VALIDATED'),
  timestamp: z.string(),
  id: z.string(),
  data: z.object({
    token: z.string(),
    isRenounced: z.boolean().optional(),
    isBurned: z.boolean().optional(),
    isLocked: z.boolean().optional(),
    lpBurnedCount: z.number().optional(),
    confidence: z.number(),
    validatedAt: z.string(),
    txSignature: z.string().optional(),
    validationDetails: z
      .object({
        mintAuthorityRenounced: z.boolean(),
        supplyBurned: z.boolean(),
        supplyBurnedPercent: z.number().optional(),
        lpTokensBurned: z.boolean(),
        liquidityLocked: z.boolean(),
      })
      .optional(),
  }),
});

export const PoolDiscoveredEventSchema = z.object({
  type: z.literal('POOL_DISCOVERED'),
  timestamp: z.string(),
  id: z.string(),
  data: z.object({
    poolAddress: z.string(),
    dexType: z.enum(['RAYDIUM', 'ORCA', 'METEORA']),
    tokenA: z.string(),
    tokenB: z.string(),
    initialTvl: z.string(),
    discoveredAt: z.string(),
    discoverySource: z.string(),
    poolData: z
      .object({
        lpMint: z.string().optional(),
        feeRate: z.number().optional(),
      })
      .optional(),
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
  PriceUpdateEventSchema,
  DEXQuoteComparisonEventSchema,
  MarketDiscoveredEventSchema,
  TokenValidatedEventSchema,
  PoolDiscoveredEventSchema,
]);

// Event type inference for type safety
export type EventUnion = z.infer<typeof EventSchema>;
export type AnyEvent = EventUnion;

// Type guards
export function isBurnEvent(event: AnyEvent): event is BurnDetectedEvent {
  return event.type === 'BURN_DETECTED';
}

export function isLiquidityEvent(event: AnyEvent): event is LiquidityChangedEvent {
  return event.type === 'LIQUIDITY_CHANGED';
}

export function isTradeEvent(event: AnyEvent): event is TradeExecutedEvent {
  return event.type === 'TRADE_EXECUTED';
}

export function isPositionOpenedEvent(event: AnyEvent): event is PositionOpenedEvent {
  return event.type === 'POSITION_OPENED';
}

export function isPositionClosedEvent(event: AnyEvent): event is PositionClosedEvent {
  return event.type === 'POSITION_CLOSED';
}

export function isWorkerStatusEvent(event: AnyEvent): event is WorkerStatusEvent {
  return event.type === 'WORKER_STATUS';
}

export function isPriceUpdateEvent(event: AnyEvent): event is PriceUpdateEvent {
  return event.type === 'PRICE_UPDATE';
}

export function isDEXQuoteComparisonEvent(event: AnyEvent): event is DEXQuoteComparisonEvent {
  return event.type === 'DEX_QUOTE_COMPARISON';
}

export function isMarketDiscoveredEvent(event: AnyEvent): event is MarketDiscoveredEvent {
  return event.type === 'MARKET_DISCOVERED';
}

export function isTokenValidatedEvent(event: AnyEvent): event is TokenValidatedEvent {
  return event.type === 'TOKEN_VALIDATED';
}

export function isPoolDiscoveredEvent(event: AnyEvent): event is PoolDiscoveredEvent {
  return event.type === 'POOL_DISCOVERED';
}

/**
 * Validate a Solana event
 */
export function validateEvent(data: unknown): AnyEvent {
  return EventSchema.parse(data);
}

// Event factory functions
export function createBurnEvent(data: z.infer<typeof BurnEventSchema>['data']): AnyEvent {
  return {
    type: 'BURN_DETECTED',
    timestamp: new Date().toISOString(),
    id: `burn-${Date.now()}`,
    data,
  };
}

export function createLiquidityEvent(data: z.infer<typeof LiquidityEventSchema>['data']): AnyEvent {
  return {
    type: 'LIQUIDITY_CHANGED',
    timestamp: new Date().toISOString(),
    id: `liquidity-${Date.now()}`,
    data,
  };
}

export function createTradeEvent(data: z.infer<typeof TradeEventSchema>['data']): AnyEvent {
  return {
    type: 'TRADE_EXECUTED',
    timestamp: new Date().toISOString(),
    id: `trade-${Date.now()}`,
    data,
  };
}

export function createPositionOpenedEvent(
  data: z.infer<typeof PositionOpenedEventSchema>['data'],
): AnyEvent {
  return {
    type: 'POSITION_OPENED',
    timestamp: new Date().toISOString(),
    id: `pos-open-${Date.now()}`,
    data,
  };
}

export function createPositionClosedEvent(
  data: z.infer<typeof PositionClosedEventSchema>['data'],
): AnyEvent {
  return {
    type: 'POSITION_CLOSED',
    timestamp: new Date().toISOString(),
    id: `pos-close-${Date.now()}`,
    data,
  };
}

export function createWorkerStatusEvent(
  data: z.infer<typeof WorkerStatusEventSchema>['data'],
): AnyEvent {
  return {
    type: 'WORKER_STATUS',
    timestamp: new Date().toISOString(),
    id: `worker-${Date.now()}`,
    data,
  };
}

export function createPriceUpdateEvent(
  data: z.infer<typeof PriceUpdateEventSchema>['data'],
): AnyEvent {
  return {
    type: 'PRICE_UPDATE',
    timestamp: new Date().toISOString(),
    id: `price-${Date.now()}`,
    data,
  };
}

export function createDEXQuoteComparisonEvent(
  data: z.infer<typeof DEXQuoteComparisonEventSchema>['data'],
): AnyEvent {
  return {
    type: 'DEX_QUOTE_COMPARISON',
    timestamp: new Date().toISOString(),
    id: `dex-comparison-${Date.now()}`,
    data,
  };
}

export function createMarketDiscoveredEvent(
  data: z.infer<typeof MarketDiscoveredEventSchema>['data'],
): AnyEvent {
  return {
    type: 'MARKET_DISCOVERED',
    timestamp: new Date().toISOString(),
    id: `market-${Date.now()}`,
    data,
  };
}

export function createTokenValidatedEvent(
  data: z.infer<typeof TokenValidatedEventSchema>['data'],
): AnyEvent {
  return {
    type: 'TOKEN_VALIDATED',
    timestamp: new Date().toISOString(),
    id: `validation-${Date.now()}`,
    data,
  };
}

export function createPoolDiscoveredEvent(
  data: z.infer<typeof PoolDiscoveredEventSchema>['data'],
): AnyEvent {
  return {
    type: 'POOL_DISCOVERED',
    timestamp: new Date().toISOString(),
    id: `pool-${Date.now()}`,
    data,
  };
}
