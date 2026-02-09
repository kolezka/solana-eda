/**
 * Worker health monitoring utilities
 * Extends base health-check with worker-specific states and dependency tracking
 */

import { HealthStatus } from './health-check';
import type { HealthCheck, HealthCheckResult } from './health-check';
import type { Redis } from 'ioredis';

/**
 * Worker lifecycle states
 */
export enum WorkerState {
  STARTING = 'STARTING',
  READY = 'READY',
  PROCESSING = 'PROCESSING',
  IDLE = 'IDLE',
  STOPPING = 'STOPPING',
  STOPPED = 'STOPPED',
  ERROR = 'ERROR',
}

/**
 * Worker health status with additional worker-specific fields
 */
export interface WorkerHealthStatus {
  workerName: string;
  state: WorkerState;
  health: HealthCheckResult;
  uptime: number;
  lastActivity: string;
  dependencies: DependencyStatus[];
  metrics: WorkerMetrics;
}

/**
 * Worker operational metrics
 */
export interface WorkerMetrics {
  eventsProcessed: number;
  eventsPerSecond: number;
  averageProcessingTime: number;
  errorCount: number;
  errorRate: number;
  lastError?: string;
  queueDepth?: number;
}

/**
 * Dependency health status
 */
export interface DependencyStatus {
  name: string;
  type: 'database' | 'redis' | 'solana-rpc' | 'solana-ws' | 'worker';
  status: HealthStatus;
  lastCheck: string;
  responseTime?: number;
  critical: boolean;
}

/**
 * Worker health configuration
 */
export interface WorkerHealthConfig {
  workerName: string;
  healthCheckInterval?: number; // milliseconds
  metricsWindow?: number; // seconds for rolling metrics
  dependencies?: WorkerDependency[];
}

/**
 * Dependency definition
 */
export interface WorkerDependency {
  name: string;
  type: 'database' | 'redis' | 'solana-rpc' | 'solana-ws' | 'worker';
  checkFn: () => Promise<boolean>;
  critical: boolean;
}

/**
 * Worker health manager
 */
export class WorkerHealthManager {
  private workerName: string;
  private state: WorkerState = WorkerState.STARTING;
  private startTime: number;
  private lastActivity: number;
  private metrics: WorkerMetrics;
  private dependencies: Map<string, WorkerDependency>;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metricsHistory: Array<{ timestamp: number; processed: number; errors: number }> = [];
  private metricsWindowSize: number;

  private eventProcessingTimes: number[] = [];
  private readonly MAX_PROCESSING_SAMPLES = 100;

  constructor(config: WorkerHealthConfig) {
    this.workerName = config.workerName;
    this.startTime = Date.now();
    this.lastActivity = this.startTime;
    this.metricsWindowSize = config.metricsWindow || 60; // 60 seconds default
    this.healthCheckInterval = null;

    this.metrics = {
      eventsProcessed: 0,
      eventsPerSecond: 0,
      averageProcessingTime: 0,
      errorCount: 0,
      errorRate: 0,
    };

    this.dependencies = new Map();
    if (config.dependencies) {
      for (const dep of config.dependencies) {
        this.dependencies.set(dep.name, dep);
      }
    }

    // Start metrics collection
    this.startMetricsCollection();
  }

  /**
   * Set worker state
   */
  setState(state: WorkerState): void {
    this.state = state;
  }

  /**
   * Get current worker state
   */
  getState(): WorkerState {
    return this.state;
  }

  /**
   * Record event processing
   */
  recordEventProcessed(processingTimeMs: number): void {
    this.metrics.eventsProcessed++;
    this.lastActivity = Date.now();

    // Track processing time
    this.eventProcessingTimes.push(processingTimeMs);
    if (this.eventProcessingTimes.length > this.MAX_PROCESSING_SAMPLES) {
      this.eventProcessingTimes.shift();
    }

    // Update average processing time
    this.metrics.averageProcessingTime =
      this.eventProcessingTimes.reduce((a, b) => a + b, 0) / this.eventProcessingTimes.length;
  }

  /**
   * Record error
   */
  recordError(error: string): void {
    this.metrics.errorCount++;
    this.metrics.lastError = error;
  }

  /**
   * Get current health status
   */
  async getHealthStatus(): Promise<WorkerHealthStatus> {
    const dependencyStatuses = await this.checkDependencies();

    // Determine overall health based on dependencies and state
    let overallHealth: HealthCheckResult;
    const hasCriticalFailure = dependencyStatuses.some(
      (d) => d.critical && d.status === HealthStatus.UNHEALTHY,
    );
    const hasAnyFailure = dependencyStatuses.some((d) => d.status === HealthStatus.UNHEALTHY);

    if (this.state === WorkerState.ERROR) {
      overallHealth = {
        status: HealthStatus.UNHEALTHY,
        checks: {},
        timestamp: new Date().toISOString(),
      };
    } else if (hasCriticalFailure) {
      overallHealth = {
        status: HealthStatus.UNHEALTHY,
        checks: {},
        timestamp: new Date().toISOString(),
      };
    } else if (hasAnyFailure || this.state === WorkerState.STARTING) {
      overallHealth = {
        status: HealthStatus.DEGRADED,
        checks: {},
        timestamp: new Date().toISOString(),
      };
    } else {
      overallHealth = {
        status: HealthStatus.HEALTHY,
        checks: {},
        timestamp: new Date().toISOString(),
      };
    }

    // Map dependency statuses to health checks
    overallHealth.checks = {};
    for (const dep of dependencyStatuses) {
      overallHealth.checks[dep.name] = {
        status: dep.status,
        lastChecked: dep.lastCheck,
        responseTime: dep.responseTime,
      };
    }

    return {
      workerName: this.workerName,
      state: this.state,
      health: overallHealth,
      uptime: Date.now() - this.startTime,
      lastActivity: new Date(this.lastActivity).toISOString(),
      dependencies: dependencyStatuses,
      metrics: { ...this.metrics },
    };
  }

  /**
   * Check all dependencies
   */
  private async checkDependencies(): Promise<DependencyStatus[]> {
    const statuses: DependencyStatus[] = [];

    for (const [name, dep] of this.dependencies.entries()) {
      const startTime = Date.now();
      let status: HealthStatus;
      let error: string | undefined;

      try {
        const healthy = await dep.checkFn();
        status = healthy ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY;
      } catch (e) {
        status = HealthStatus.UNHEALTHY;
        error = (e as Error).message;
      }

      const responseTime = Date.now() - startTime;

      statuses.push({
        name,
        type: dep.type,
        status,
        lastCheck: new Date().toISOString(),
        responseTime,
        critical: dep.critical,
      });
    }

    return statuses;
  }

  /**
   * Start periodic metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      this.updateMetrics();
    }, 1000); // Update every second
  }

  /**
   * Update rolling metrics
   */
  private updateMetrics(): void {
    const now = Date.now();
    const cutoff = now - this.metricsWindowSize * 1000;

    // Filter old metrics
    this.metricsHistory = this.metricsHistory.filter((m) => m.timestamp > cutoff);

    // Add current snapshot
    this.metricsHistory.push({
      timestamp: now,
      processed: this.metrics.eventsProcessed,
      errors: this.metrics.errorCount,
    });

    // Calculate events per second
    if (this.metricsHistory.length >= 2) {
      const oldest = this.metricsHistory[0];
      const newest = this.metricsHistory[this.metricsHistory.length - 1];
      if (oldest && newest) {
        const timeDiff = (newest.timestamp - oldest.timestamp) / 1000;
        const eventsDiff = newest.processed - oldest.processed;

        this.metrics.eventsPerSecond = timeDiff > 0 ? eventsDiff / timeDiff : 0;
      }
    }

    // Calculate error rate
    if (this.metrics.eventsProcessed > 0) {
      this.metrics.errorRate = this.metrics.errorCount / this.metrics.eventsProcessed;
    }
  }

  /**
   * Shutdown health manager
   */
  shutdown(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Create ready check for HTTP/health endpoint
   */
  isReady(): boolean {
    return (
      this.state === WorkerState.READY ||
      this.state === WorkerState.PROCESSING ||
      this.state === WorkerState.IDLE
    );
  }

  /**
   * Create alive check for HTTP/health endpoint
   */
  isAlive(): boolean {
    return this.state !== WorkerState.STOPPED;
  }
}

/**
 * Create dependency check functions
 */
export class DependencyChecks {
  /**
   * Create Redis dependency check
   */
  static redis(client: Redis): () => Promise<boolean> {
    return async () => {
      try {
        const result = await client.ping();
        return result === 'PONG';
      } catch {
        return false;
      }
    };
  }

  /**
   * Create database dependency check
   */
  static database(prisma: any): () => Promise<boolean> {
    return async () => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        return true;
      } catch {
        return false;
      }
    };
  }

  /**
   * Create Solana RPC dependency check
   */
  static solanaRPC(connection: any): () => Promise<boolean> {
    return async () => {
      try {
        await connection.getVersion();
        return true;
      } catch {
        return false;
      }
    };
  }

  /**
   * Create Solana WebSocket dependency check
   */
  static solanaWS(connection: any): () => Promise<boolean> {
    return async () => {
      try {
        const wsConn = connection.getWsConnection();
        return wsConn !== null;
      } catch {
        return false;
      }
    };
  }

  /**
   * Create worker dependency check (via Redis pub/sub)
   */
  static worker(redisClient: Redis, workerName: string): () => Promise<boolean> {
    return async () => {
      try {
        const statusKey = `worker:status:${workerName}`;
        const status = await redisClient.get(statusKey);
        if (!status) return false;

        const parsed = JSON.parse(status);
        return parsed.status !== 'STOPPED' && parsed.status !== 'ERROR';
      } catch {
        return false;
      }
    };
  }
}

/**
 * Factory to create a standard worker health configuration
 */
export function createWorkerHealthConfig(
  workerName: string,
  dependencies: {
    redis?: Redis;
    database?: any;
    solanaRPC?: any;
    solanaWS?: any;
  },
): WorkerHealthConfig {
  const deps: WorkerDependency[] = [];

  if (dependencies.redis) {
    deps.push({
      name: 'redis',
      type: 'redis',
      checkFn: DependencyChecks.redis(dependencies.redis),
      critical: true,
    });
  }

  if (dependencies.database) {
    deps.push({
      name: 'database',
      type: 'database',
      checkFn: DependencyChecks.database(dependencies.database),
      critical: true,
    });
  }

  if (dependencies.solanaRPC) {
    deps.push({
      name: 'solana-rpc',
      type: 'solana-rpc',
      checkFn: DependencyChecks.solanaRPC(dependencies.solanaRPC),
      critical: true,
    });
  }

  if (dependencies.solanaWS) {
    deps.push({
      name: 'solana-ws',
      type: 'solana-ws',
      checkFn: DependencyChecks.solanaWS(dependencies.solanaWS),
      critical: false,
    });
  }

  return {
    workerName,
    healthCheckInterval: 30000, // 30 seconds
    metricsWindow: 60,
    dependencies: deps,
  };
}
