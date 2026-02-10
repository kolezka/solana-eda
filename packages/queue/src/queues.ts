/**
 * BullMQ Queue Names
 *
 * These constants define the queue names used throughout the system.
 * Each queue corresponds to a specific event type or domain.
 */

export const QUEUE_NAMES = {
  /** Token burn events */
  BURN_EVENTS: 'burn-events',

  /** Liquidity change events */
  LIQUIDITY_EVENTS: 'liquidity-events',

  /** Trade execution events */
  TRADE_EVENTS: 'trade-events',

  /** Position events (opened/closed) */
  POSITION_EVENTS: 'position-events',

  /** Price update events */
  PRICE_EVENTS: 'price-events',

  /** Market discovery events */
  MARKET_EVENTS: 'market-events',

  /** Token validation events */
  TOKEN_EVENTS: 'token-events',

  /** Pool discovery events */
  POOL_EVENTS: 'pool-events',

  /** DEX comparison events */
  DEX_COMPARISON_EVENTS: 'dex-comparison-events',

  /** Worker status events */
  WORKERS_STATUS: 'workers-status',
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];

/**
 * Queue priority levels
 */
export const JOB_PRIORITY = {
  CRITICAL: 1,
  HIGH: 3,
  NORMAL: 5,
  LOW: 7,
} as const;

/**
 * Queue name to event type mapping
 */
export const QUEUE_EVENT_MAPPING: Record<string, string[]> = {
  'burn-events': ['BURN_DETECTED'],
  'liquidity-events': ['LIQUIDITY_CHANGED'],
  'trade-events': ['TRADE_EXECUTED'],
  'position-events': ['POSITION_OPENED', 'POSITION_CLOSED'],
  'price-events': ['PRICE_UPDATE'],
  'market-events': ['MARKET_DISCOVERED'],
  'token-events': ['TOKEN_VALIDATED'],
  'pool-events': ['POOL_DISCOVERED'],
  'dex-comparison-events': ['DEX_QUOTE_COMPARISON'],
  'workers-status': ['WORKER_STATUS'],
};

/**
 * Get queue name for an event type
 */
export function getQueueForEventType(eventType: string): string | null {
  for (const [queueName, eventTypes] of Object.entries(QUEUE_EVENT_MAPPING)) {
    if (eventTypes.includes(eventType)) {
      return queueName;
    }
  }
  return null;
}
