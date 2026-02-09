/**
 * Worker Publisher Helper
 * Provides unified event publishing interface for workers
 * Supports dual-write mode (Redis + RabbitMQ) for migration
 */

import Redis from 'ioredis';

// Redis channel names (extracted from index.ts to avoid circular dependency)
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

export interface WorkerPublisherConfig {
  redis: Redis;
  rabbitMQProducer?: {
    publish(eventType: string, data: Record<string, unknown>, options?: { routingKey?: string }): Promise<void>;
  };
  enableRabbitMQ?: boolean;
  dualWrite?: boolean;
  workerName: string;
}

export interface WorkerPublisherMetrics {
  eventsProcessed: number;
  errors: number;
  uptime: number;
  lastEventAt?: string;
  // Event-specific metrics
  burnsDetected?: number;
  tradesExecuted?: number;
  pricesPublished?: number;
  // RabbitMQ metrics
  rabbitMQPublishSuccess?: number;
  rabbitMQPublishFailure?: number;
  rabbitMQEnabled?: boolean;
}

/**
 * Worker Publisher class
 * Handles publishing events to Redis and/or RabbitMQ
 */
export class WorkerPublisher {
  private readonly config: WorkerPublisherConfig;
  private readonly enableRabbitMQ: boolean;
  private readonly dualWrite: boolean;

  constructor(config: WorkerPublisherConfig) {
    this.config = config;
    this.enableRabbitMQ = config.enableRabbitMQ || false;
    this.dualWrite = config.dualWrite || false;
  }

  /**
   * Publish an event to configured backends
   */
  async publish(channel: string, event: Record<string, unknown>): Promise<void> {
    const promises: Promise<unknown>[] = [];

    // Always publish to Redis (current behavior)
    promises.push(
      this.config.redis.publish(channel, JSON.stringify(event))
    );

    // Publish to RabbitMQ if enabled
    if (this.enableRabbitMQ && this.config.rabbitMQProducer) {
      try {
        // Map Redis channel to RabbitMQ routing key
        const eventType = event.type as string;
        const routingKey = this.channelToRoutingKey(channel, eventType);
        await this.config.rabbitMQProducer.publish(
          eventType,
          event.data as Record<string, unknown>,
          { routingKey }
        );
      } catch (error) {
        console.error(`[WorkerPublisher] RabbitMQ publish failed:`, error);
        // Don't throw - allow Redis to succeed
      }
    }

    await Promise.all(promises);
  }

  /**
   * Publish worker status
   */
  async publishStatus(
    status: 'RUNNING' | 'STOPPED' | 'ERROR',
    metrics: WorkerPublisherMetrics
  ): Promise<void> {
    const statusEvent = {
      type: 'WORKER_STATUS' as const,
      timestamp: new Date().toISOString(),
      id: `${this.config.workerName}-status-${Date.now()}`,
      data: {
        workerName: this.config.workerName,
        status,
        metrics: {
          eventsProcessed: metrics.eventsProcessed,
          errors: metrics.errors,
          uptime: metrics.uptime,
          lastEventAt: metrics.lastEventAt,
        },
      },
    };

    return this.publish(CHANNELS.WORKERS_STATUS, statusEvent);
  }

  /**
   * Check if RabbitMQ publishing is enabled
   */
  isRabbitMQEnabled(): boolean {
    return this.enableRabbitMQ && !!this.config.rabbitMQProducer;
  }

  /**
   * Map Redis channel to RabbitMQ routing key
   */
  private channelToRoutingKey(channel: string, eventType: string): string {
    // For worker status, use specific routing pattern
    if (channel === CHANNELS.WORKERS_STATUS) {
      return `worker.${this.config.workerName}.${eventType.toLowerCase()}`;
    }

    // Map event types to routing keys
    const routingKeyMap: Record<string, string> = {
      BURN_DETECTED: 'burn.detected',
      LIQUIDITY_CHANGED: 'liquidity.changed',
      TRADE_EXECUTED: 'trade.executed',
      POSITION_OPENED: 'position.opened',
      POSITION_CLOSED: 'position.closed',
      WORKER_STATUS: 'worker.status',
      PRICE_UPDATE: 'price.updated',
      MARKET_DISCOVERED: 'market.discovered',
      TOKEN_VALIDATED: 'token.validated',
      POOL_DISCOVERED: 'pool.discovered',
    };

    return routingKeyMap[eventType] || eventType.toLowerCase().replace(/_/g, '.');
  }

  /**
   * Create WorkerPublisher instance for a worker
   */
  static create(config: WorkerPublisherConfig): WorkerPublisher {
    return new WorkerPublisher(config);
  }
}

/**
 * Feature flag helpers
 */
export class WorkerPublisherFeatureFlags {
  static isRabbitMQEnabled(): boolean {
    return process.env.RABBITMQ_ENABLED === 'true';
  }

  static isDualWriteEnabled(): boolean {
    return process.env.RABBITMQ_DUAL_WRITE === 'true';
  }

  static isDualReadEnabled(): boolean {
    return process.env.RABBITMQ_DUAL_READ === 'true';
  }

  static getRabbitMQUrl(): string {
    return process.env.RABBITMQ_URL || 'amqp://solana:solana123@localhost:5672';
  }
}
