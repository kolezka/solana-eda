import type { JobsOptions } from 'bullmq';
import type { AnyEvent } from './index';
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

// Re-export deduplication utilities for BullMQ jobs
export {
  generateJobId,
  createJobOptionsWithDeduplication,
  checkJobDuplicate,
} from './deduplication';

/**
 * BullMQ queue names for each event type
 */
export const QUEUE_NAMES = {
  BURN: 'events:burn',
  LIQUIDITY: 'events:liquidity',
  TRADES: 'events:trades',
  POSITIONS: 'events:positions',
  DEX_COMPARISON: 'events:dex-comparison',
  PRICE: 'events:price',
  MARKETS: 'events:markets',
  TOKENS: 'events:tokens',
  POOLS: 'events:pools',
  WORKERS_STATUS: 'workers:status',
} as const;

/**
 * Job priority mapping for event types
 * Lower number = higher priority
 */
export const JOB_PRIORITIES = {
  BURN_DETECTED: 1,      // highest priority
  TRADE_EXECUTED: 2,
  POSITION_OPENED: 2,
  POSITION_CLOSED: 2,
  LIQUIDITY_CHANGED: 5,
  DEX_QUOTE_COMPARISON: 5,
  MARKET_DISCOVERED: 5,
  TOKEN_VALIDATED: 5,
  POOL_DISCOVERED: 5,
  WORKER_STATUS: 5,
  PRICE_UPDATE: 10,      // lowest priority (high frequency)
} as const;

/**
 * Default job options for BullMQ jobs
 */
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
};

/**
 * Get priority for an event type
 */
export function getEventPriority(eventType: AnyEvent['type']): number {
  return JOB_PRIORITIES[eventType as keyof typeof JOB_PRIORITIES] ?? 5;
}

/**
 * Get queue name for an event type
 */
export function getQueueNameForEvent(eventType: AnyEvent['type']): string {
  const queueMapping: Record<string, string> = {
    BURN_DETECTED: QUEUE_NAMES.BURN,
    LIQUIDITY_CHANGED: QUEUE_NAMES.LIQUIDITY,
    TRADE_EXECUTED: QUEUE_NAMES.TRADES,
    POSITION_OPENED: QUEUE_NAMES.POSITIONS,
    POSITION_CLOSED: QUEUE_NAMES.POSITIONS,
    WORKER_STATUS: QUEUE_NAMES.WORKERS_STATUS,
    PRICE_UPDATE: QUEUE_NAMES.PRICE,
    DEX_QUOTE_COMPARISON: QUEUE_NAMES.DEX_COMPARISON,
    MARKET_DISCOVERED: QUEUE_NAMES.MARKETS,
    TOKEN_VALIDATED: QUEUE_NAMES.TOKENS,
    POOL_DISCOVERED: QUEUE_NAMES.POOLS,
  };
  return queueMapping[eventType] ?? 'events:default';
}

/**
 * BullMQ job data interface for burn events
 */
export interface BurnJobData {
  type: 'BURN_DETECTED';
  timestamp: string;
  id: string;
  eventId?: string;
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

/**
 * BullMQ job data interface for liquidity events
 */
export interface LiquidityJobData {
  type: 'LIQUIDITY_CHANGED';
  timestamp: string;
  id: string;
  eventId?: string;
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

/**
 * BullMQ job data interface for trade events
 */
export interface TradeJobData {
  type: 'TRADE_EXECUTED';
  timestamp: string;
  id: string;
  eventId?: string;
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

/**
 * BullMQ job data interface for position opened events
 */
export interface PositionOpenedJobData {
  type: 'POSITION_OPENED';
  timestamp: string;
  id: string;
  eventId?: string;
  data: {
    positionId: string;
    token: string;
    amount: string;
    entryPrice: string;
    stopLoss?: string;
    takeProfit?: string;
  };
}

/**
 * BullMQ job data interface for position closed events
 */
export interface PositionClosedJobData {
  type: 'POSITION_CLOSED';
  timestamp: string;
  id: string;
  eventId?: string;
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

/**
 * BullMQ job data interface for worker status events
 */
export interface WorkerStatusJobData {
  type: 'WORKER_STATUS';
  timestamp: string;
  id: string;
  eventId?: string;
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

/**
 * BullMQ job data interface for price update events
 */
export interface PriceUpdateJobData {
  type: 'PRICE_UPDATE';
  timestamp: string;
  id: string;
  eventId?: string;
  data: {
    token: string;
    price: string;
    source: string;
    confidence: number;
    volume24h?: string;
    priceChange24h?: number;
    sources: Array<{
      dex: string;
      price: string;
      volume24h?: string;
    }>;
  };
}

/**
 * BullMQ job data interface for DEX quote comparison events
 */
export interface DEXQuoteComparisonJobData {
  type: 'DEX_QUOTE_COMPARISON';
  timestamp: string;
  id: string;
  eventId?: string;
  data: {
    inputMint: string;
    outputMint: string;
    amount: string;
    quotes: Array<{
      dex: string;
      outAmount: string;
      priceImpactPct: number;
    }>;
    selectedDEX: string;
    bestQuote: {
      dex: string;
      outAmount: string;
      priceImpactPct: number;
    };
  };
}

/**
 * BullMQ job data interface for market discovered events
 */
export interface MarketDiscoveredJobData {
  type: 'MARKET_DISCOVERED';
  timestamp: string;
  id: string;
  eventId?: string;
  data: {
    marketAddress: string;
    baseMint: string;
    quoteMint: string;
    dexType: 'OPENBOOK' | 'RAYDIUM' | 'ORCA' | 'METEORA';
    discoveredAt: string;
    source: string;
    marketData?: {
      name?: string;
      minOrderSize?: string;
      tickSize?: string;
    };
  };
}

/**
 * BullMQ job data interface for token validated events
 */
export interface TokenValidatedJobData {
  type: 'TOKEN_VALIDATED';
  timestamp: string;
  id: string;
  eventId?: string;
  data: {
    token: string;
    isRenounced?: boolean;
    isBurned?: boolean;
    isLocked?: boolean;
    lpBurnedCount?: number;
    confidence: number;
    validatedAt: string;
    txSignature?: string;
    validationDetails?: {
      mintAuthorityRenounced: boolean;
      supplyBurned: boolean;
      supplyBurnedPercent?: number;
      lpTokensBurned: boolean;
      liquidityLocked: boolean;
    };
  };
}

/**
 * BullMQ job data interface for pool discovered events
 */
export interface PoolDiscoveredJobData {
  type: 'POOL_DISCOVERED';
  timestamp: string;
  id: string;
  eventId?: string;
  data: {
    poolAddress: string;
    dexType: 'RAYDIUM' | 'ORCA' | 'METEORA';
    tokenA: string;
    tokenB: string;
    initialTvl: string;
    discoveredAt: string;
    discoverySource: string;
    poolData?: {
      lpMint?: string;
      feeRate?: number;
    };
  };
}

/**
 * Union type for all BullMQ job data types
 */
export type EventJobData =
  | BurnJobData
  | LiquidityJobData
  | TradeJobData
  | PositionOpenedJobData
  | PositionClosedJobData
  | WorkerStatusJobData
  | PriceUpdateJobData
  | DEXQuoteComparisonJobData
  | MarketDiscoveredJobData
  | TokenValidatedJobData
  | PoolDiscoveredJobData;

/**
 * Convert an event to BullMQ job data
 */
export function eventToJobData(event: AnyEvent): EventJobData {
  return event as EventJobData;
}

/**
 * Create BullMQ job options for an event
 * Uses eventId (UUID) when available for deduplication, otherwise falls back to legacy id
 */
export function createJobOptions(
  event: AnyEvent,
  customOptions?: JobsOptions,
): JobsOptions {
  const priority = getEventPriority(event.type);
  return {
    ...DEFAULT_JOB_OPTIONS,
    ...customOptions,
    priority,
    jobId: event.eventId || event.id,
  };
}

/**
 * Job factory functions for each event type
 * These create the complete job specification (name + data + options)
 */

export interface JobSpec<T = EventJobData> {
  name: string;
  data: T;
  opts: JobsOptions;
}

/**
 * Create a BullMQ job specification for a burn event
 */
export function createBurnJob(event: BurnDetectedEvent, customOptions?: JobsOptions): JobSpec<BurnJobData> {
  return {
    name: 'BURN_DETECTED',
    data: eventToJobData(event) as BurnJobData,
    opts: createJobOptions(event, customOptions),
  };
}

/**
 * Create a BullMQ job specification for a liquidity event
 */
export function createLiquidityJob(
  event: LiquidityChangedEvent,
  customOptions?: JobsOptions,
): JobSpec<LiquidityJobData> {
  return {
    name: 'LIQUIDITY_CHANGED',
    data: eventToJobData(event) as LiquidityJobData,
    opts: createJobOptions(event, customOptions),
  };
}

/**
 * Create a BullMQ job specification for a trade event
 */
export function createTradeJob(event: TradeExecutedEvent, customOptions?: JobsOptions): JobSpec<TradeJobData> {
  return {
    name: 'TRADE_EXECUTED',
    data: eventToJobData(event) as TradeJobData,
    opts: createJobOptions(event, customOptions),
  };
}

/**
 * Create a BullMQ job specification for a position opened event
 */
export function createPositionOpenedJob(
  event: PositionOpenedEvent,
  customOptions?: JobsOptions,
): JobSpec<PositionOpenedJobData> {
  return {
    name: 'POSITION_OPENED',
    data: eventToJobData(event) as PositionOpenedJobData,
    opts: createJobOptions(event, customOptions),
  };
}

/**
 * Create a BullMQ job specification for a position closed event
 */
export function createPositionClosedJob(
  event: PositionClosedEvent,
  customOptions?: JobsOptions,
): JobSpec<PositionClosedJobData> {
  return {
    name: 'POSITION_CLOSED',
    data: eventToJobData(event) as PositionClosedJobData,
    opts: createJobOptions(event, customOptions),
  };
}

/**
 * Create a BullMQ job specification for a worker status event
 */
export function createWorkerStatusJob(
  event: WorkerStatusEvent,
  customOptions?: JobsOptions,
): JobSpec<WorkerStatusJobData> {
  return {
    name: 'WORKER_STATUS',
    data: eventToJobData(event) as WorkerStatusJobData,
    opts: createJobOptions(event, customOptions),
  };
}

/**
 * Create a BullMQ job specification for a price update event
 */
export function createPriceUpdateJob(
  event: PriceUpdateEvent,
  customOptions?: JobsOptions,
): JobSpec<PriceUpdateJobData> {
  return {
    name: 'PRICE_UPDATE',
    data: eventToJobData(event) as PriceUpdateJobData,
    opts: createJobOptions(event, customOptions),
  };
}

/**
 * Create a BullMQ job specification for a DEX quote comparison event
 */
export function createDEXQuoteComparisonJob(
  event: DEXQuoteComparisonEvent,
  customOptions?: JobsOptions,
): JobSpec<DEXQuoteComparisonJobData> {
  return {
    name: 'DEX_QUOTE_COMPARISON',
    data: eventToJobData(event) as DEXQuoteComparisonJobData,
    opts: createJobOptions(event, customOptions),
  };
}

/**
 * Create a BullMQ job specification for a market discovered event
 */
export function createMarketDiscoveredJob(
  event: MarketDiscoveredEvent,
  customOptions?: JobsOptions,
): JobSpec<MarketDiscoveredJobData> {
  return {
    name: 'MARKET_DISCOVERED',
    data: eventToJobData(event) as MarketDiscoveredJobData,
    opts: createJobOptions(event, customOptions),
  };
}

/**
 * Create a BullMQ job specification for a token validated event
 */
export function createTokenValidatedJob(
  event: TokenValidatedEvent,
  customOptions?: JobsOptions,
): JobSpec<TokenValidatedJobData> {
  return {
    name: 'TOKEN_VALIDATED',
    data: eventToJobData(event) as TokenValidatedJobData,
    opts: createJobOptions(event, customOptions),
  };
}

/**
 * Create a BullMQ job specification for a pool discovered event
 */
export function createPoolDiscoveredJob(
  event: PoolDiscoveredEvent,
  customOptions?: JobsOptions,
): JobSpec<PoolDiscoveredJobData> {
  return {
    name: 'POOL_DISCOVERED',
    data: eventToJobData(event) as PoolDiscoveredJobData,
    opts: createJobOptions(event, customOptions),
  };
}

/**
 * Generic factory to create a job specification from any event
 */
export function createJobFromEvent(event: AnyEvent, customOptions?: JobsOptions): JobSpec {
  switch (event.type) {
    case 'BURN_DETECTED':
      return createBurnJob(event as BurnDetectedEvent, customOptions);
    case 'LIQUIDITY_CHANGED':
      return createLiquidityJob(event as LiquidityChangedEvent, customOptions);
    case 'TRADE_EXECUTED':
      return createTradeJob(event as TradeExecutedEvent, customOptions);
    case 'POSITION_OPENED':
      return createPositionOpenedJob(event as PositionOpenedEvent, customOptions);
    case 'POSITION_CLOSED':
      return createPositionClosedJob(event as PositionClosedEvent, customOptions);
    case 'WORKER_STATUS':
      return createWorkerStatusJob(event as WorkerStatusEvent, customOptions);
    case 'PRICE_UPDATE':
      return createPriceUpdateJob(event as PriceUpdateEvent, customOptions);
    case 'DEX_QUOTE_COMPARISON':
      return createDEXQuoteComparisonJob(event as DEXQuoteComparisonEvent, customOptions);
    case 'MARKET_DISCOVERED':
      return createMarketDiscoveredJob(event as MarketDiscoveredEvent, customOptions);
    case 'TOKEN_VALIDATED':
      return createTokenValidatedJob(event as TokenValidatedEvent, customOptions);
    case 'POOL_DISCOVERED':
      return createPoolDiscoveredJob(event as PoolDiscoveredEvent, customOptions);
    default:
      // Fallback for unknown event types (should never happen with proper typing)
      const unknownEvent = event as AnyEvent;
      return {
        name: unknownEvent.type,
        data: eventToJobData(unknownEvent),
        opts: createJobOptions(unknownEvent, customOptions),
      };
  }
}

/**
 * Get the queue name for a given event
 */
export function getQueueForEvent(event: AnyEvent): string {
  return getQueueNameForEvent(event.type);
}
