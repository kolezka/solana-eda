import { Queue, JobsOptions } from 'bullmq';
import type { AnyEvent } from '@solana-eda/types';
import { getRedisConnection, loadQueueConfig, type QueueConfig } from './config';
import { QUEUE_NAMES, JOB_PRIORITY, getQueueForEventType, type QueueName } from './queues';

/**
 * Base producer options
 */
export interface ProducerOptions {
  /** Queue name to produce jobs to */
  queueName?: QueueName;
  /** Override default job options */
  jobOptions?: JobsOptions;
  /** Custom queue configuration */
  config?: QueueConfig;
}

/**
 * Job data wrapper
 */
export interface JobData<T = AnyEvent> {
  /** The event data */
  event: T;
  /** Optional metadata */
  metadata?: {
    source?: string;
    timestamp?: string;
    version?: string;
  };
}

/**
 * Result of adding a job
 */
export interface JobResult {
  /** Job ID */
  jobId: string;
  /** Queue name */
  queueName: string;
  /** Event type */
  eventType: string;
}

/**
 * Base Producer class for adding jobs to BullMQ queues
 */
export class BaseProducer {
  private queues: Map<QueueName, Queue> = new Map();
  private config: QueueConfig;
  private connection: ReturnType<typeof getRedisConnection>;

  constructor(options: ProducerOptions = {}) {
    this.config = options.config || loadQueueConfig();
    this.connection = getRedisConnection();
  }

  /**
   * Get or create a queue for the given name
   */
  private getQueue(queueName: QueueName): Queue {
    if (!this.queues.has(queueName)) {
      const queue = new Queue(queueName, {
        connection: this.connection,
        defaultJobOptions: {
          ...this.config.defaultJobOptions,
          ...this.getQueueSpecificOptions(queueName),
        },
      });

      this.queues.set(queueName, queue);
    }

    return this.queues.get(queueName)!;
  }

  /**
   * Get queue-specific options based on the queue name
   */
  private getQueueSpecificOptions(queueName: QueueName): Partial<JobsOptions> {
    switch (queueName) {
      case QUEUE_NAMES.WORKERS_STATUS:
        // High priority for worker status
        return {
          priority: JOB_PRIORITY.HIGH,
          attempts: 1, // Don't retry status updates
        };

      case QUEUE_NAMES.TRADE_EVENTS:
      case QUEUE_NAMES.POSITION_EVENTS:
        // Critical for trades and positions
        return {
          priority: JOB_PRIORITY.CRITICAL,
          attempts: 5, // More retries for financial events
        };

      case QUEUE_NAMES.BURN_EVENTS:
      case QUEUE_NAMES.LIQUIDITY_EVENTS:
      case QUEUE_NAMES.PRICE_EVENTS:
        // High priority for market events
        return {
          priority: JOB_PRIORITY.HIGH,
        };

      default:
        return {};
    }
  }

  /**
   * Add an event to a queue
   */
  async add(
    event: AnyEvent,
    options: {
      queueName?: QueueName;
      jobOptions?: JobsOptions;
      metadata?: JobData['metadata'];
    } = {},
  ): Promise<JobResult> {
    const queueName = options.queueName || (getQueueForEventType(event.type) as QueueName | null);
    if (!queueName) {
      throw new Error(`No queue found for event type: ${event.type}`);
    }

    const queue = this.getQueue(queueName as QueueName);

    const jobData: JobData = {
      event,
      metadata: {
        timestamp: new Date().toISOString(),
        ...options.metadata,
      },
    };

    const job = await queue.add(
      event.type,
      jobData,
      options.jobOptions,
    );

    return {
      jobId: job.id ?? '',
      queueName,
      eventType: event.type,
    };
  }

  /**
   * Add multiple events to queues in bulk
   */
  async addBulk(
    events: AnyEvent[],
    options: {
      jobOptions?: JobsOptions;
      metadata?: JobData['metadata'];
    } = {},
  ): Promise<JobResult[]> {
    const results: JobResult[] = [];

    for (const event of events) {
      const result = await this.add(event, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Add a job with a specific delay
   */
  async addDelayed(
    event: AnyEvent,
    delayMs: number,
    options: {
      queueName?: QueueName;
      metadata?: JobData['metadata'];
    } = {},
  ): Promise<JobResult> {
    return this.add(event, {
      ...options,
      jobOptions: {
        delay: delayMs,
      },
    });
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName: QueueName): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const queue = this.getQueue(queueName);

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
    };
  }

  /**
   * Clean up resources
   */
  async close(): Promise<void> {
    const closePromises = Array.from(this.queues.values()).map((queue) => queue.close());
    await Promise.all(closePromises);
    this.queues.clear();
  }

  /**
   * Pause a queue
   */
  async pauseQueue(queueName: QueueName): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.pause();
  }

  /**
   * Resume a paused queue
   */
  async resumeQueue(queueName: QueueName): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.resume();
  }

  /**
   * Obliterate a queue (remove all jobs)
   * Use with caution!
   */
  async obliterateQueue(queueName: QueueName): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.obliterate({ force: true });
  }
}

/**
 * Create a singleton producer instance
 */
let defaultProducer: BaseProducer | null = null;

export function createProducer(options?: ProducerOptions): BaseProducer {
  if (!defaultProducer) {
    defaultProducer = new BaseProducer(options);
  }
  return defaultProducer;
}

export function getProducer(): BaseProducer {
  if (!defaultProducer) {
    defaultProducer = createProducer();
  }
  return defaultProducer;
}

/**
 * Convenience function to add an event to the queue
 */
export async function addEventToQueue(
  event: AnyEvent,
  options?: {
    queueName?: QueueName;
    jobOptions?: JobsOptions;
    metadata?: JobData['metadata'];
  },
): Promise<JobResult> {
  const producer = getProducer();
  return producer.add(event, options);
}

/**
 * Convenience function to add multiple events to the queue
 */
export async function addEventsToQueue(
  events: AnyEvent[],
  options?: {
    jobOptions?: JobsOptions;
    metadata?: JobData['metadata'];
  },
): Promise<JobResult[]> {
  const producer = getProducer();
  return producer.addBulk(events, options);
}
