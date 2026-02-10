import { Worker, Job } from 'bullmq';
import type { AnyEvent } from '@solana-eda/types';
import { createWorkerRedisConnection, loadQueueConfig, type QueueConfig } from './config';
import { type QueueName } from './queues';

/**
 * Worker processor function type
 */
export type ProcessorFunction<T = AnyEvent> = (
  job: Job<JobData<T>>,
) => Promise<void> | void;

/**
 * Job data wrapper
 */
export interface JobData<T = AnyEvent> {
  event: T;
  metadata?: {
    source?: string;
    timestamp?: string;
    version?: string;
  };
}

/**
 * Base worker options
 */
export interface BaseWorkerOptions {
  /** Queue name to consume from */
  queueName: QueueName;
  /** Concurrency level (number of jobs processed in parallel) */
  concurrency?: number;
  /** Custom queue configuration */
  config?: QueueConfig;
  /** Custom worker connection (for separate processes) */
  connection?: ReturnType<typeof createWorkerRedisConnection>;
  /** Maximum number of job stalling attempts before giving up */
  maxStalledCount?: number;
  /** Stalled interval (ms) to check for stalled jobs */
  stalledInterval?: number;
}

/**
 * Worker event callbacks
 */
export interface WorkerCallbacks {
  /** Called when a job starts processing */
  onActive?: (job: Job, prev?: string) => void | Promise<void>;
  /** Called when a job completes successfully */
  onCompleted?: (job: Job, result: unknown) => void | Promise<void>;
  /** Called when a job fails */
  onFailed?: (job: Job | undefined, error: Error) => void | Promise<void>;
  /** Called when worker is ready */
  onReady?: () => void | Promise<void>;
  /** Called when worker encounters an error */
  onError?: (error: Error) => void | Promise<void>;
  /** Called when job progress is updated */
  onProgress?: (job: Job, progress: number) => void | Promise<void>;
}

/**
 * Worker metrics
 */
export interface WorkerMetrics {
  /** Total jobs processed */
  processed: number;
  /** Total jobs failed */
  failed: number;
  /** Current active jobs */
  active: number;
  /** Worker start time */
  startedAt: Date;
  /** Worker uptime in seconds */
  uptime: number;
}

/**
 * Base Worker class for processing BullMQ jobs
 */
export class BaseWorker {
  private worker: Worker;
  private connection: ReturnType<typeof createWorkerRedisConnection>;
  private metrics: WorkerMetrics;
  private options: BaseWorkerOptions;
  private callbacks: WorkerCallbacks;
  private processor: ProcessorFunction;

  constructor(
    processor: ProcessorFunction,
    options: BaseWorkerOptions,
    callbacks: WorkerCallbacks = {},
  ) {
    this.options = options;
    this.callbacks = callbacks;
    this.processor = processor;
    this.connection = options.connection || createWorkerRedisConnection(options.config);

    this.metrics = {
      processed: 0,
      failed: 0,
      active: 0,
      startedAt: new Date(),
      uptime: 0,
    };

    this.worker = new Worker(
      options.queueName,
      async (job: Job) => {
        return this.handleJob(job);
      },
      {
        connection: this.connection,
        concurrency: options.concurrency || 1,
        autorun: false,
        maxStalledCount: options.maxStalledCount || 1,
        stalledInterval: options.stalledInterval || 30000,
      },
    );

    this.attachEventListeners();
  }

  /**
   * Internal job handler with metrics tracking
   */
  private async handleJob(job: Job): Promise<void> {
    this.metrics.active++;

    try {
      await this.processor(job);
      this.metrics.processed++;
    } finally {
      this.metrics.active--;
    }
  }

  /**
   * Attach event listeners to the worker
   */
  private attachEventListeners(): void {
    this.worker.on('active', async (job, prev) => {
      if (this.callbacks.onActive) {
        await this.callbacks.onActive(job, prev);
      }
    });

    this.worker.on('completed', async (job, result) => {
      if (this.callbacks.onCompleted) {
        await this.callbacks.onCompleted(job, result);
      }
    });

    this.worker.on('failed', async (job, error) => {
      this.metrics.failed++;
      if (this.callbacks.onFailed) {
        await this.callbacks.onFailed(job, error);
      }
    });

    this.worker.on('ready', async () => {
      if (this.callbacks.onReady) {
        await this.callbacks.onReady();
      }
    });

    this.worker.on('error', async (error) => {
      if (this.callbacks.onError) {
        await this.callbacks.onError(error);
      }
    });

    this.worker.on('progress', async (job, progress) => {
      if (this.callbacks.onProgress) {
        await this.callbacks.onProgress(job, typeof progress === 'number' ? progress : 0);
      }
    });
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    this.metrics.startedAt = new Date();
    await this.worker.run();
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    await this.worker.close();
  }

  /**
   * Pause the worker (stop processing new jobs)
   */
  async pause(): Promise<void> {
    await this.worker.pause();
  }

  /**
   * Resume the worker
   */
  async resume(): Promise<void> {
    await this.worker.resume();
  }

  /**
   * Get current worker metrics
   */
  getMetrics(): WorkerMetrics {
    return {
      ...this.metrics,
      uptime: Math.floor((Date.now() - this.metrics.startedAt.getTime()) / 1000),
    };
  }

  /**
   * Get the queue name this worker is processing
   */
  getQueueName(): QueueName {
    return this.options.queueName;
  }

  /**
   * Get the worker instance (for advanced use cases)
   */
  getWorker(): Worker {
    return this.worker;
  }

  /**
   * Check if worker is running
   */
  isRunning(): boolean {
    return this.worker.isRunning();
  }
}

/**
 * Worker configuration for specific queue types
 */
export interface WorkerConfig {
  queueName: QueueName;
  processor: ProcessorFunction;
  concurrency?: number;
  callbacks?: WorkerCallbacks;
}

/**
 * Create a worker for a specific queue
 */
export function createWorker(
  queueName: QueueName,
  processor: ProcessorFunction,
  options: Omit<BaseWorkerOptions, 'queueName' | 'processor'> = {},
  callbacks: WorkerCallbacks = {},
): BaseWorker {
  return new BaseWorker(processor, { ...options, queueName }, callbacks);
}

/**
 * Create multiple workers for different queues
 */
export function createWorkerPool(
  configs: WorkerConfig[],
  sharedOptions: Omit<BaseWorkerOptions, 'queueName' | 'processor'> = {},
): BaseWorker[] {
  return configs.map((config) =>
    createWorker(
      config.queueName,
      config.processor,
      { ...sharedOptions, concurrency: config.concurrency },
      config.callbacks || {},
    ),
  );
}

/**
 * Type guard for job data
 */
export function isValidJobData(data: unknown): data is JobData {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const jobData = data as JobData;
  return (
    typeof jobData.event === 'object' &&
    jobData.event !== null &&
    typeof jobData.event.type === 'string' &&
    typeof jobData.event.timestamp === 'string'
  );
}

/**
 * Extract event from job data
 */
export function extractEvent<T = AnyEvent>(job: Job): T {
  if (!isValidJobData(job.data)) {
    throw new Error(`Invalid job data in job ${job.id}`);
  }
  return job.data.event as T;
}

/**
 * Job progress updater helper
 */
export async function updateJobProgress(
  job: Job,
  progress: number,
  message?: string,
): Promise<void> {
  await job.updateProgress(progress);
  if (message) {
    await job.log(message);
  }
}
