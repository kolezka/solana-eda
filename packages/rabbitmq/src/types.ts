/**
 * RabbitMQ Configuration Types
 * Based on Phase 1 RabbitMQ Architecture Plan
 * @see docs/PHASE1_RABBITMQ_RPC_PLAN.md
 */

/**
 * RabbitMQ connection configuration
 */
export interface RabbitMQConfig {
  /** Connection URL format: amqp://user:password@host:port */
  url: string;
  /** Default exchange name (usually 'solana.events') */
  exchangeName?: string;
  /** Default exchange type (topic, fanout, direct) */
  exchangeType?: 'topic' | 'fanout' | 'direct';
  /** Message prefetch count for consumers */
  prefetchCount?: number;
  /** Reconnection delay in milliseconds */
  reconnectDelay?: number;
  /** Enable publisher confirms for guaranteed delivery */
  enablePublisherConfirms?: boolean;
  /** Maximum connection retry attempts */
  maxRetries?: number;
}

/**
 * Event envelope for all RabbitMQ messages
 * Provides versioning, correlation, and causation tracking
 */
export interface EventEnvelope {
  /** Event schema version for compatibility */
  version: string;
  /** Unique event identifier (UUID) */
  id: string;
  /** Correlation ID for tracing related events */
  correlationId?: string;
  /** Causation ID for event chain tracking */
  causationId?: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Event type (e.g., BURN_DETECTED, LIQUIDITY_CHANGED) */
  type: string;
  /** Routing key for topic exchange */
  routingKey: string;
  /** Event payload */
  data: unknown;
  /** Source worker/service name */
  source?: string;
}

/**
 * Queue configuration with DLQ support
 */
export interface QueueConfig {
  /** Queue name */
  name: string;
  /** Routing key patterns to bind */
  routingKeys: string[];
  /** Whether queue is durable (survives restart) */
  durable?: boolean;
  /** Dead letter exchange name */
  deadLetterExchange?: string;
  /** Dead letter routing key */
  deadLetterRoutingKey?: string;
  /** Message TTL in milliseconds */
  messageTtl?: number;
  /** Queue length limit */
  maxLength?: number;
}

/**
 * RabbitMQ exchange configuration
 */
export interface ExchangeConfig {
  /** Exchange name */
  name: string;
  /** Exchange type */
  type: 'topic' | 'fanout' | 'direct';
  /** Whether exchange is durable */
  durable?: boolean;
  /** Auto-delete exchange when no queues bound */
  autoDelete?: boolean;
}

/**
 * Message publishing options
 */
export interface PublishOptions {
  /** Routing key for topic exchange */
  routingKey: string;
  /** Message priority (0-9) */
  priority?: number;
  /** Message expiration */
  expiration?: string;
  /** Message persistence */
  persistent?: boolean;
  /** Correlation ID for tracing */
  correlationId?: string;
  /** Causation ID for event chain */
  causationId?: string;
}

/**
 * Message acknowledgment options
 */
export interface AckOptions {
  /** Requeue message on negative acknowledgment */
  requeue?: boolean;
  /** Multiple messages acknowledgment */
  multiple?: boolean;
}

/**
 * Consumer message handler
 */
export type MessageHandler = (message: EventEnvelope, ack: () => void, nack: (options?: AckOptions) => void) => void | Promise<void>;

/**
 * Consumer configuration
 */
export interface ConsumerConfig {
  /** Queue name to consume from */
  queueName: string;
  /** Message handler function */
  handler: MessageHandler;
  /** Consumer tag identifier */
  consumerTag?: string;
  /** Whether to use manual acknowledgment */
  manualAck?: boolean;
  /** Prefetch count for this consumer */
  prefetch?: number;
}

/**
 * Connection health status
 */
export interface ConnectionHealth {
  /** Whether connection is active */
  connected: boolean;
  /** Connection URL (sanitized) */
  url: string;
  /** Current connection attempt */
  attempt: number;
  /** Last connection error */
  lastError?: string;
  /** Connection timestamp */
  connectedAt?: string;
}

/**
 * Publisher metrics
 */
export interface PublisherMetrics {
  /** Total messages published */
  totalPublished: number;
  /** Messages confirmed */
  confirmed: number;
  /** Messages failed to publish */
  failed: number;
  /** Current pending messages */
  pending: number;
}

/**
 * Consumer metrics
 */
export interface ConsumerMetrics {
  /** Total messages processed */
  totalProcessed: number;
  /** Messages acknowledged */
  acknowledged: number;
  /** Messages negatively acknowledged */
  nacked: number;
  /** Messages rejected without requeue */
  rejected: number;
  /** Current processing messages */
  processing: number;
}

/**
 * Exchange topology constants
 */
export const EXCHANGES = {
  /** Main topic exchange for all events */
  EVENTS: 'solana.events',
  /** Fanout exchange for worker status */
  STATUS: 'solana.status',
  /** Dead letter exchange for failed messages */
  DLQ: 'solana.dlq',
} as const;

/**
 * Queue names for Solana EDA events
 */
export const QUEUES = {
  /** Burn detected events */
  BURN_EVENTS: 'q.burn.events',
  /** Trade execution events */
  TRADE_EVENTS: 'q.trade.events',
  /** Price update events */
  PRICE_EVENTS: 'q.price.events',
  /** Liquidity change events */
  LIQUIDITY_EVENTS: 'q.liquidity.events',
  /** Position lifecycle events */
  POSITION_EVENTS: 'q.positions',
  /** Worker status events */
  WORKERS_STATUS: 'q.workers',
  /** Token launch events */
  TOKEN_LAUNCH: 'q.token.launch',
  /** Market events */
  MARKET_EVENTS: 'q.market.events',
  /** Arbitrage opportunity events */
  ARBITRAGE_EVENTS: 'q.arbitrage',
  /** System events */
  SYSTEM_EVENTS: 'q.system',
} as const;

/**
 * Routing key patterns for events
 */
export const ROUTING_KEYS = {
  /** Burn events: burn.detected, burn.large */
  BURN: 'burn.*',
  /** Trade events: trade.executed, trade.failed, trade.confirmed */
  TRADE: 'trade.*',
  /** Price events: price.updated, price.threshold */
  PRICE: 'price.*',
  /** Liquidity events: liquidity.added, liquidity.removed, liquidity.changed */
  LIQUIDITY: 'liquidity.*',
  /** Position events: position.opened, position.closed, position.updated */
  POSITION: 'position.*',
  /** Worker status: worker.*, worker.started, worker.stopped */
  WORKER: 'worker.*',
  /** Token events: token.*, token.launched, token.delist */
  TOKEN: 'token.*',
  /** Market events: market.*, market.trending */
  MARKET: 'market.*',
} as const;
