import { Injectable, Logger } from '@nestjs/common';
import { FeatureFlags } from '@solana-eda/events';
import {
  BullMQHealthChecker,
  BullMQQueueHealth,
  BullMQSystemHealth,
  QueueMetrics,
  BullMQWorkerHealth,
  type BullMQHealthConfig,
  HealthStatus,
} from '@solana-eda/monitoring';
import { BULLMQ_QUEUES } from '@solana-eda/queue-bullmq';
import Redis from 'ioredis';

/**
 * Queue metrics DTO with additional fields
 */
interface QueueMetricsWithMetadata extends QueueMetrics {
  queueName: string;
  timestamp: string;
}

/**
 * Queue status response DTO
 */
interface QueuesStatusResponse {
  totalQueues: number;
  healthyQueues: number;
  degradedQueues: number;
  unhealthyQueues: number;
  totalWaiting: number;
  totalActive: number;
  totalCompleted: number;
  totalFailed: number;
  queues: Record<string, QueueMetricsWithMetadata>;
  timestamp: string;
}

/**
 * Queues service for BullMQ monitoring
 */
@Injectable()
export class QueuesService {
  private readonly logger = new Logger(QueuesService.name);
  private bullMQChecker: BullMQHealthChecker | null = null;
  private redisConnection: Redis | null = null;

  constructor() {
    this.initializeBullMQHealthChecker();
  }

  /**
   * Initialize BullMQ health checker if enabled
   */
  private initializeBullMQHealthChecker(): void {
    if (!FeatureFlags.isBullMQEnabled()) {
      this.logger.log('BullMQ is not enabled, skipping health checker initialization');
      return;
    }

    try {
      // Create Redis connection for BullMQ health checks
      const redisUrl = FeatureFlags.getBullMQRedisUrl();
      const redisUrlParsed = new URL(redisUrl);

      this.redisConnection = new Redis({
        host: redisUrlParsed.hostname,
        port: parseInt(redisUrlParsed.port) || 6379,
        username: redisUrlParsed.username || undefined,
        password: redisUrlParsed.password || undefined,
        db: parseInt(redisUrlParsed.pathname.slice(1)) || 0,
        maxRetriesPerRequest: null,
      });

      // Get all queue names
      const queueNames = Object.values(BULLMQ_QUEUES);

      const config: BullMQHealthConfig = {
        connection: this.redisConnection,
        queues: queueNames,
      };

      this.bullMQChecker = new BullMQHealthChecker(config);
      this.logger.log(`BullMQ health checker initialized with ${queueNames.length} queues`);
    } catch (error) {
      this.logger.error('Failed to initialize BullMQ health checker', error);
    }
  }

  /**
   * Get overall queue status
   */
  async getQueuesStatus(): Promise<{
    totalQueues: number;
    healthyQueues: number;
    degradedQueues: number;
    unhealthyQueues: number;
    totalWaiting: number;
    totalActive: number;
    totalCompleted: number;
    totalFailed: number;
    queues: Record<string, {
      queueName: string;
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
      paused: boolean;
      isPaused: boolean;
      timestamp: string;
    }>;
    timestamp: string;
  }> {
    if (!this.bullMQChecker) {
      return {
        totalQueues: 0,
        healthyQueues: 0,
        degradedQueues: 0,
        unhealthyQueues: 0,
        totalWaiting: 0,
        totalActive: 0,
        totalCompleted: 0,
        totalFailed: 0,
        queues: {},
        timestamp: new Date().toISOString(),
      };
    }

    const queueMetrics = await this.bullMQChecker.getAllQueueMetrics();
    const queueHealths: BullMQQueueHealth[] = [];

    // Get health for each queue
    for (const queueName of Object.keys(queueMetrics)) {
      const health = await this.bullMQChecker!.getQueueHealth(queueName);
      queueHealths.push(health);
    }

    // Calculate totals
    let healthyQueues = 0;
    let degradedQueues = 0;
    let unhealthyQueues = 0;
    let totalWaiting = 0;
    let totalActive = 0;
    let totalCompleted = 0;
    let totalFailed = 0;

    for (const health of queueHealths) {
      if (health.status === HealthStatus.HEALTHY) healthyQueues++;
      else if (health.status === HealthStatus.DEGRADED) degradedQueues++;
      else unhealthyQueues++;

      totalWaiting += health.metrics.waiting;
      totalActive += health.metrics.active;
      totalCompleted += health.metrics.completed;
      totalFailed += health.metrics.failed;
    }

    // Transform metrics to DTO format with additional fields
    const queuesDto: Record<string, {
      queueName: string;
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
      paused: boolean;
      isPaused: boolean;
      timestamp: string;
    }> = {};
    for (const [queueName, metrics] of Object.entries(queueMetrics)) {
      queuesDto[queueName] = {
        queueName,
        ...metrics,
        timestamp: new Date().toISOString(),
      };
    }

    return {
      totalQueues: queueHealths.length,
      healthyQueues,
      degradedQueues,
      unhealthyQueues,
      totalWaiting,
      totalActive,
      totalCompleted,
      totalFailed,
      queues: queuesDto,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get system health
   */
  async getSystemHealth(): Promise<{
    status: HealthStatus;
    queues: Record<string, {
      queueName: string;
      status: HealthStatus;
      metrics: {
        queueName: string;
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
        paused: boolean;
        isPaused: boolean;
        timestamp: string;
      };
      timestamp: string;
    }>;
    workers: Record<string, {
      workerName: string;
      status: HealthStatus;
      isRunning: boolean;
      isProcessing: boolean;
      concurrency: number;
      jobsProcessed: number;
      jobsFailed: number;
      timestamp: string;
    }>;
    timestamp: string;
  }> {
    if (!this.bullMQChecker) {
      return {
        status: HealthStatus.UNHEALTHY,
        queues: {},
        workers: {},
        timestamp: new Date().toISOString(),
      };
    }

    const systemHealth = await this.bullMQChecker.getSystemHealth();

    // Transform queues to DTO format
    const queuesDto: Record<string, {
      queueName: string;
      status: HealthStatus;
      metrics: {
        queueName: string;
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
        paused: boolean;
        isPaused: boolean;
        timestamp: string;
      };
      timestamp: string;
    }> = {};

    for (const [queueName, health] of Object.entries(systemHealth.queues)) {
      queuesDto[queueName] = {
        ...health,
        metrics: {
          queueName,
          ...health.metrics,
          timestamp: health.timestamp,
        },
      };
    }

    return {
      ...systemHealth,
      queues: queuesDto,
    };
  }

  /**
   * Get specific queue details
   */
  async getQueueDetails(queueName: string): Promise<{
    queueName: string;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: boolean;
    isPaused: boolean;
    timestamp: string;
  } | null> {
    if (!this.bullMQChecker) {
      return null;
    }

    const metrics = await this.bullMQChecker.getQueueMetrics(queueName);
    if (!metrics) {
      return null;
    }

    return {
      queueName,
      ...metrics,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get queue health status
   */
  async getQueueHealth(queueName: string): Promise<{
    queueName: string;
    status: HealthStatus;
    metrics: {
      queueName: string;
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
      paused: boolean;
      isPaused: boolean;
      timestamp: string;
    };
    timestamp: string;
  }> {
    if (!this.bullMQChecker) {
      return {
        queueName,
        status: HealthStatus.UNHEALTHY,
        metrics: {
          queueName,
          waiting: 0,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          paused: false,
          isPaused: false,
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
    }

    const health = await this.bullMQChecker.getQueueHealth(queueName);
    return {
      ...health,
      metrics: {
        queueName,
        ...health.metrics,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Get workers status
   */
  async getWorkersStatus(): Promise<Record<string, BullMQWorkerHealth>> {
    if (!this.bullMQChecker) {
      return {};
    }

    const systemHealth = await this.bullMQChecker.getSystemHealth();
    return systemHealth.workers;
  }

  /**
   * Get specific worker status
   */
  async getWorkerStatus(workerName: string): Promise<BullMQWorkerHealth | null> {
    if (!this.bullMQChecker) {
      return null;
    }

    return await this.bullMQChecker.getWorkerHealth(workerName);
  }

  /**
   * Close connections
   */
  async onModuleDestroy(): Promise<void> {
    if (this.bullMQChecker) {
      await this.bullMQChecker.close();
    }
    if (this.redisConnection) {
      await this.redisConnection.quit();
    }
  }
}
