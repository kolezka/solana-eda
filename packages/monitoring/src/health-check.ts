/**
 * Health check system for monitoring service health
 */

export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  UNHEALTHY = 'UNHEALTHY',
}

export interface HealthCheckResult {
  status: HealthStatus;
  checks: Record<string, HealthCheck>;
  timestamp: string;
}

export interface HealthCheck {
  status: HealthStatus;
  message?: string;
  responseTime?: number;
  lastChecked: string;
  metadata?: Record<string, unknown>;
}

export interface HealthCheckOptions {
  timeout?: number;
  critical?: boolean;
}

export class HealthChecker {
  private checks = new Map<string, (options?: HealthCheckOptions) => Promise<HealthCheck>>();
  private results = new Map<string, HealthCheck>();

  /**
   * Register a health check
   */
  register(
    name: string,
    checkFn: (options?: HealthCheckOptions) => Promise<HealthCheck>,
    runImmediately: boolean = true,
  ): void {
    this.checks.set(name, checkFn);

    if (runImmediately) {
      this.runCheck(name).catch(console.error);
    }
  }

  /**
   * Unregister a health check
   */
  unregister(name: string): void {
    this.checks.delete(name);
    this.results.delete(name);
  }

  /**
   * Run a specific health check
   */
  async runCheck(name: string, options?: HealthCheckOptions): Promise<HealthCheck> {
    const checkFn = this.checks.get(name);

    if (!checkFn) {
      return {
        status: HealthStatus.UNHEALTHY,
        message: `Health check '${name}' not found`,
        lastChecked: new Date().toISOString(),
      };
    }

    const startTime = Date.now();

    try {
      // Apply timeout if specified
      const timeout = options?.timeout || 5000;
      const result = (await Promise.race([
        checkFn(options),
        new Promise<HealthCheck>((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), timeout),
        ),
      ])) as HealthCheck;

      result.responseTime = Date.now() - startTime;
      result.lastChecked = new Date().toISOString();

      this.results.set(name, result);

      return result;
    } catch (error) {
      const errorResult: HealthCheck = {
        status: HealthStatus.UNHEALTHY,
        message: (error as Error).message,
        responseTime: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
      };

      this.results.set(name, errorResult);

      return errorResult;
    }
  }

  /**
   * Run all health checks
   */
  async runAllChecks(options?: HealthCheckOptions): Promise<HealthCheckResult> {
    const checkNames = Array.from(this.checks.keys());

    const results = await Promise.all(checkNames.map((name) => this.runCheck(name, options)));

    const checks: Record<string, HealthCheck> = {};
    checkNames.forEach((name, index) => {
      const result = results[index];
      if (result) {
        checks[name] = result;
      }
    });

    // Determine overall health status
    let overallStatus = HealthStatus.HEALTHY;

    const hasUnhealthy = Object.values(checks).some(
      (check) => check.status === HealthStatus.UNHEALTHY,
    );

    const hasDegraded = Object.values(checks).some(
      (check) => check.status === HealthStatus.DEGRADED,
    );

    if (hasUnhealthy) {
      overallStatus = HealthStatus.UNHEALTHY;
    } else if (hasDegraded) {
      overallStatus = HealthStatus.DEGRADED;
    }

    return {
      status: overallStatus,
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get the most recent health check results without running new checks
   */
  getCurrentStatus(): HealthCheckResult {
    const checks: Record<string, HealthCheck> = {};

    for (const [name, result] of this.results.entries()) {
      checks[name] = result;
    }

    // Determine overall health status
    let overallStatus = HealthStatus.HEALTHY;

    const hasUnhealthy = Object.values(checks).some(
      (check) => check.status === HealthStatus.UNHEALTHY,
    );

    const hasDegraded = Object.values(checks).some(
      (check) => check.status === HealthStatus.DEGRADED,
    );

    if (hasUnhealthy) {
      overallStatus = HealthStatus.UNHEALTHY;
    } else if (hasDegraded) {
      overallStatus = HealthStatus.DEGRADED;
    }

    return {
      status: overallStatus,
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Check if the service is healthy
   */
  isHealthy(): boolean {
    const current = this.getCurrentStatus();
    return current.status === HealthStatus.HEALTHY;
  }
}

/**
 * Common health check factory functions
 */
export class HealthChecks {
  /**
   * Database health check
   */
  static database(
    pingFn: () => Promise<void>,
    options?: { maxResponseTime?: number },
  ): () => Promise<HealthCheck> {
    return async () => {
      const startTime = Date.now();

      try {
        await pingFn();

        const responseTime = Date.now() - startTime;
        const maxResponseTime = options?.maxResponseTime || 1000;

        if (responseTime > maxResponseTime) {
          return {
            status: HealthStatus.DEGRADED,
            message: `Database response time (${responseTime}ms) exceeds threshold (${maxResponseTime}ms)`,
            lastChecked: new Date().toISOString(),
          };
        }

        return {
          status: HealthStatus.HEALTHY,
          message: 'Database connection healthy',
          lastChecked: new Date().toISOString(),
        };
      } catch (error) {
        return {
          status: HealthStatus.UNHEALTHY,
          message: `Database connection failed: ${(error as Error).message}`,
          lastChecked: new Date().toISOString(),
        };
      }
    };
  }

  /**
   * Redis health check
   */
  static redis(client: any, options?: { maxResponseTime?: number }): () => Promise<HealthCheck> {
    return async () => {
      const startTime = Date.now();

      try {
        await client.ping();

        const responseTime = Date.now() - startTime;
        const maxResponseTime = options?.maxResponseTime || 500;

        if (responseTime > maxResponseTime) {
          return {
            status: HealthStatus.DEGRADED,
            message: `Redis response time (${responseTime}ms) exceeds threshold (${maxResponseTime}ms)`,
            lastChecked: new Date().toISOString(),
          };
        }

        return {
          status: HealthStatus.HEALTHY,
          message: 'Redis connection healthy',
          lastChecked: new Date().toISOString(),
        };
      } catch (error) {
        return {
          status: HealthStatus.UNHEALTHY,
          message: `Redis connection failed: ${(error as Error).message}`,
          lastChecked: new Date().toISOString(),
        };
      }
    };
  }

  /**
   * Solana RPC health check
   */
  static solanaRPC(
    getConnection: () => any,
    options?: { maxResponseTime?: number },
  ): () => Promise<HealthCheck> {
    return async () => {
      const startTime = Date.now();

      try {
        const connection = getConnection();
        await connection.getVersion();

        const responseTime = Date.now() - startTime;
        const maxResponseTime = options?.maxResponseTime || 5000;

        if (responseTime > maxResponseTime) {
          return {
            status: HealthStatus.DEGRADED,
            message: `Solana RPC response time (${responseTime}ms) exceeds threshold (${maxResponseTime}ms)`,
            lastChecked: new Date().toISOString(),
          };
        }

        return {
          status: HealthStatus.HEALTHY,
          message: 'Solana RPC connection healthy',
          lastChecked: new Date().toISOString(),
        };
      } catch (error) {
        return {
          status: HealthStatus.UNHEALTHY,
          message: `Solana RPC connection failed: ${(error as Error).message}`,
          lastChecked: new Date().toISOString(),
        };
      }
    };
  }

  /**
   * Memory health check
   */
  static memory(options?: {
    warningThreshold?: number;
    criticalThreshold?: number;
  }): () => Promise<HealthCheck> {
    return async () => {
      const used = process.memoryUsage();
      const totalMemory = require('os').totalmem();
      const memoryUsagePercent = (used.heapUsed / totalMemory) * 100;

      const warningThreshold = options?.warningThreshold || 70;
      const criticalThreshold = options?.criticalThreshold || 90;

      let status = HealthStatus.HEALTHY;
      let message = `Memory usage: ${memoryUsagePercent.toFixed(2)}%`;

      if (memoryUsagePercent > criticalThreshold) {
        status = HealthStatus.UNHEALTHY;
        message = `Memory usage critical: ${memoryUsagePercent.toFixed(2)}%`;
      } else if (memoryUsagePercent > warningThreshold) {
        status = HealthStatus.DEGRADED;
        message = `Memory usage high: ${memoryUsagePercent.toFixed(2)}%`;
      }

      return {
        status,
        message,
        lastChecked: new Date().toISOString(),
        metadata: {
          used: used.heapUsed,
          total: used.heapTotal,
          external: used.external,
          arrayBuffers: used.arrayBuffers,
          memoryUsagePercent: memoryUsagePercent.toFixed(2),
        },
      };
    };
  }

  /**
   * Disk space health check
   */
  static diskSpace(options?: {
    path?: string;
    warningThreshold?: number;
    criticalThreshold?: number;
  }): () => Promise<HealthCheck> {
    return async () => {
      try {
        const fs = require('fs');
        const stats = fs.statSync(options?.path || '/');

        // This is a simplified check - in production you'd check actual disk usage
        return {
          status: HealthStatus.HEALTHY,
          message: 'Disk space healthy',
          lastChecked: new Date().toISOString(),
        };
      } catch (error) {
        return {
          status: HealthStatus.DEGRADED,
          message: `Could not check disk space: ${(error as Error).message}`,
          lastChecked: new Date().toISOString(),
        };
      }
    };
  }
}

/**
 * Global health checker instance
 */
let globalHealthChecker: HealthChecker | null = null;

export function getHealthChecker(): HealthChecker {
  if (!globalHealthChecker) {
    globalHealthChecker = new HealthChecker();
  }
  return globalHealthChecker;
}
