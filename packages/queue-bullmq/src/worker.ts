/**
 * BullMQ Producer for Workers
 * Simplified producer that can be used in standalone worker processes
 */

import Redis from 'ioredis';
import { BullMQProducer } from './producer';
import type { BullMQQueueName, SolanaJobData } from './types';

export interface WorkerBullMQConfig {
  redisUrl?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  db?: number;
}

let producerInstance: BullMQProducer | null = null;

/**
 * Initialize BullMQ producer for a worker
 */
export async function initWorkerBullMQ(config: WorkerBullMQConfig = {}): Promise<BullMQProducer> {
  if (producerInstance) {
    return producerInstance;
  }

  // Parse Redis URL if provided
  let connectionConfig: any = {
    host: config.host || 'localhost',
    port: config.port || 6379,
    db: config.db || 0,
  };

  if (config.redisUrl) {
    const url = new URL(config.redisUrl);
    connectionConfig = {
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      username: url.username || undefined,
      password: url.password || undefined,
      db: parseInt(url.pathname.slice(1)) || 0,
    };
  } else if (process.env.REDIS_URL) {
    const url = new URL(process.env.REDIS_URL);
    connectionConfig = {
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      username: url.username || undefined,
      password: url.password || undefined,
      db: parseInt(url.pathname.slice(1)) || 0,
    };
  }

  producerInstance = new BullMQProducer({
    connection: connectionConfig,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  });

  return producerInstance;
}

/**
 * Publish event from worker to BullMQ
 */
export async function publishWorkerEvent(
  producer: BullMQProducer,
  queueName: BullMQQueueName,
  eventType: string,
  eventId: string,
  data: Record<string, unknown>
): Promise<void> {
  const jobData: SolanaJobData = {
    eventType: eventType as any,
    eventId,
    timestamp: new Date().toISOString(),
    data,
  };

  await producer.addJob(queueName, jobData);
}

/**
 * Get the shared BullMQ producer instance
 */
export function getWorkerBullMQ(): BullMQProducer | null {
  return producerInstance;
}

/**
 * Close worker BullMQ connection
 */
export async function closeWorkerBullMQ(): Promise<void> {
  if (producerInstance) {
    await producerInstance.close();
    producerInstance = null;
  }
}
