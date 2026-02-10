/**
 * BullMQ Producer for Solana EDA
 * Handles publishing jobs to BullMQ queues
 */

import { Queue } from 'bullmq';
import Redis from 'ioredis';
import type {
  BullMQProducerConfig,
  BullMQProducerMetrics,
  BullMQQueueName,
  SolanaJobData,
} from './types';

export class BullMQProducer {
  private queues: Map<BullMQQueueName, Queue> = new Map();
  private connection: Redis;
  private metrics: BullMQProducerMetrics = {
    jobsAdded: 0,
    jobsFailed: 0,
    jobsCompleted: 0,
  };
  private defaultJobOptions: any;

  constructor(config: BullMQProducerConfig) {
    // Create Redis connection
    this.connection = new Redis({
      host: config.connection.host,
      port: config.connection.port,
      username: config.connection.username,
      password: config.connection.password,
      db: config.connection.db || 0,
      maxRetriesPerRequest: null,
    });

    this.defaultJobOptions = config.defaultJobOptions || {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        count: 1000,
        age: 3600, // 1 hour
      },
      removeOnFail: {
        count: 5000,
        age: 86400, // 24 hours
      },
    };
  }

  /**
   * Add a job to the specified queue
   */
  async addJob(
    queueName: BullMQQueueName,
    jobData: SolanaJobData,
    options?: any
  ): Promise<void> {
    try {
      let queue = this.queues.get(queueName);

      if (!queue) {
        queue = new Queue(queueName, {
          connection: this.connection,
          defaultJobOptions: this.defaultJobOptions,
        });
        this.queues.set(queueName, queue);
      }

      const jobName = `${jobData.eventType}:${jobData.eventId}`;

      await queue.add(jobName, jobData, {
        ...this.defaultJobOptions,
        ...options,
      });

      this.metrics.jobsAdded++;
      this.metrics.lastJobAt = new Date().toISOString();
    } catch (error) {
      this.metrics.jobsFailed++;
      throw error;
    }
  }

  /**
   * Add multiple jobs in bulk
   */
  async addBulkJobs(
    queueName: BullMQQueueName,
    jobs: Array<{ name: string; data: SolanaJobData; opts?: any }>
  ): Promise<void> {
    try {
      let queue = this.queues.get(queueName);

      if (!queue) {
        queue = new Queue(queueName, {
          connection: this.connection,
          defaultJobOptions: this.defaultJobOptions,
        });
        this.queues.set(queueName, queue);
      }

      await queue.addBulk(jobs);
      this.metrics.jobsAdded += jobs.length;
    } catch (error) {
      this.metrics.jobsFailed += jobs.length;
      throw error;
    }
  }

  /**
   * Get producer metrics
   */
  getMetrics(): BullMQProducerMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      jobsAdded: 0,
      jobsFailed: 0,
      jobsCompleted: 0,
    };
  }

  /**
   * Gracefully close all queue connections
   */
  async close(): Promise<void> {
    const closePromises: Promise<void>[] = [];

    for (const [name, queue] of this.queues) {
      closePromises.push(
        queue.close().then(() => {
          // Remove from map after closing
          this.queues.delete(name);
        })
      );
    }

    await Promise.all(closePromises);
    await this.connection.quit();
  }

  /**
   * Get queue instance for a specific queue name
   */
  getQueue(queueName: BullMQQueueName): Queue | undefined {
    return this.queues.get(queueName);
  }
}
