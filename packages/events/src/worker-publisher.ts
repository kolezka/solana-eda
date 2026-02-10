/**
 * Worker Publisher Helper
 * Provides unified event publishing interface for workers
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
}

/**
 * Worker Publisher class
 * Handles publishing events to Redis
 */
export class WorkerPublisher {
  private readonly config: WorkerPublisherConfig;

  constructor(config: WorkerPublisherConfig) {
    this.config = config;
  }

  /**
   * Publish an event to Redis
   */
  async publish(channel: string, event: Record<string, unknown>): Promise<void> {
    await this.config.redis.publish(channel, JSON.stringify(event));
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
   * Create WorkerPublisher instance for a worker
   */
  static create(config: WorkerPublisherConfig): WorkerPublisher {
    return new WorkerPublisher(config);
  }
}
