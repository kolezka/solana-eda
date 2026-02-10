import { Module, Global, Provider, InjectionToken, Inject, Injectable, OnModuleInit, OnModuleDestroy, DynamicModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BULLMQ_QUEUES, type BullMQQueueName } from '@solana-eda/queue-bullmq';
import { FeatureFlags } from '@solana-eda/events';

/**
 * BullMQ connection options interface
 */
export interface BullMQOptions {
  redisUrl: string;
  concurrency: number;
  isGlobal: boolean;
}

/**
 * BullMQ Module Configuration Token
 */
export const BULLMQ_OPTIONS = 'BULLMQ_OPTIONS';

/**
 * BullMQ Connection Token
 */
export const BULLMQ_CONNECTION = 'BULLMQ_CONNECTION';

/**
 * BullMQ Worker Manager Token
 */
export const BULLMQ_WORKER_MANAGER = 'BULLMQ_WORKER_MANAGER';

/**
 * BullMQ Connection Provider
 */
@Injectable()
export class BullMQConnectionProvider implements OnModuleInit, OnModuleDestroy {
  private connection: Redis | null = null;

  constructor(private configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    if (!FeatureFlags.isBullMQEnabled()) {
      return;
    }

    const redisUrl = FeatureFlags.getBullMQRedisUrl();
    const url = new URL(redisUrl);

    this.connection = new Redis({
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      username: url.username || undefined,
      password: url.password || undefined,
      db: parseInt(url.pathname.slice(1)) || 0,
      maxRetriesPerRequest: null,
    });

    this.connection.on('error', (error) => {
      console.error('[BullMQ] Redis connection error:', error);
    });

    this.connection.on('connect', () => {
      console.log('[BullMQ] Redis connected');
    });
  }

  getConnection(): Redis {
    if (!this.connection) {
      throw new Error('BullMQ connection not initialized');
    }
    return this.connection;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.connection) {
      await this.connection.quit();
      this.connection = null;
    }
  }
}

/**
 * BullMQ Worker Manager
 * Manages all BullMQ workers for the API
 */
@Injectable()
export class BullMQWorkerManager implements OnModuleInit, OnModuleDestroy {
  private workers: Map<string, Worker> = new Map();
  private queues: Map<string, Queue> = new Map();

  constructor(
    @Inject(BULLMQ_CONNECTION) private connectionProvider: BullMQConnectionProvider,
    private eventEmitter: EventEmitter2,
    private configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!FeatureFlags.isBullMQEnabled()) {
      console.log('[BullMQ] Workers disabled by feature flag');
      return;
    }

    console.log('[BullMQ] Initializing worker manager...');
  }

  /**
   * Get or create a queue
   */
  getQueue(queueName: BullMQQueueName): Queue {
    if (this.queues.has(queueName)) {
      return this.queues.get(queueName)!;
    }

    const connection = this.connectionProvider.getConnection();
    const queue = new Queue(queueName, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    this.queues.set(queueName, queue);
    return queue;
  }

  /**
   * Register a worker for a specific queue
   */
  registerWorker(
    queueName: BullMQQueueName,
    processor: (job: Job) => Promise<void>,
    options?: { concurrency?: number },
  ): Worker {
    if (this.workers.has(queueName)) {
      console.log(`[BullMQ] Worker for ${queueName} already registered`);
      return this.workers.get(queueName)!;
    }

    const connection = this.connectionProvider.getConnection();
    const concurrency = options?.concurrency || FeatureFlags.getBullMQConcurrency();

    const worker = new Worker(
      queueName,
      async (job: Job) => {
        try {
          await processor(job);
        } catch (error) {
          console.error(`[BullMQ] Error processing job ${job.id}:`, error);
          throw error;
        }
      },
      {
        connection,
        concurrency,
      },
    );

    worker.on('completed', (job) => {
      console.log(`[BullMQ] Job ${job.id} completed in queue ${queueName}`);
    });

    worker.on('failed', (job, error) => {
      console.error(`[BullMQ] Job ${job?.id} failed in queue ${queueName}:`, error.message);
    });

    worker.on('error', (error) => {
      console.error(`[BullMQ] Worker error for ${queueName}:`, error);
    });

    this.workers.set(queueName, worker);
    console.log(`[BullMQ] Worker registered for queue: ${queueName} (concurrency: ${concurrency})`);

    return worker;
  }

  /**
   * Get a registered worker
   */
  getWorker(queueName: string): Worker | undefined {
    return this.workers.get(queueName);
  }

  /**
   * Close all workers
   */
  async onModuleDestroy(): Promise<void> {
    console.log('[BullMQ] Closing all workers...');

    for (const [queueName, worker] of this.workers.entries()) {
      try {
        await worker.close();
        console.log(`[BullMQ] Worker closed for ${queueName}`);
      } catch (error) {
        console.error(`[BullMQ] Error closing worker for ${queueName}:`, error);
      }
    }

    this.workers.clear();

    for (const [queueName, queue] of this.queues.entries()) {
      try {
        await queue.close();
        console.log(`[BullMQ] Queue closed for ${queueName}`);
      } catch (error) {
        console.error(`[BullMQ] Error closing queue ${queueName}:`, error);
      }
    }

    this.queues.clear();
  }

  /**
   * Get worker stats
   */
  getStats(): {
    workersCount: number;
    queuesCount: number;
    queues: Array<{ name: string; workers: number }>;
  } {
    return {
      workersCount: this.workers.size,
      queuesCount: this.queues.size,
      queues: Array.from(this.queues.keys()).map((name) => ({
        name,
        workers: this.workers.has(name) ? 1 : 0,
      })),
    };
  }
}

/**
 * BullMQ Module
 */
@Global()
@Module({
  providers: [
    BullMQConnectionProvider,
    BullMQWorkerManager,
    {
      provide: BULLMQ_CONNECTION,
      useExisting: BullMQConnectionProvider,
    },
    {
      provide: BULLMQ_WORKER_MANAGER,
      useExisting: BullMQWorkerManager,
    },
  ],
  exports: [
    BULLMQ_CONNECTION,
    BULLMQ_WORKER_MANAGER,
    BullMQConnectionProvider,
    BullMQWorkerManager,
  ],
})
export class BullMQModule {
  static forRoot(options: BullMQOptions): DynamicModule {
    return {
      module: BullMQModule,
      providers: [
        {
          provide: BULLMQ_OPTIONS,
          useValue: options,
        },
      ],
      exports: [
        BULLMQ_OPTIONS,
      ],
    };
  }
}
