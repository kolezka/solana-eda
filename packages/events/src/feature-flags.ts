/**
 * Feature Flags for Solana EDA
 * Provides centralized configuration for feature toggles
 */

export class FeatureFlags {
  /**
   * Check if RabbitMQ publishing is enabled
   */
  static isRabbitMQEnabled(): boolean {
    return process.env.RABBITMQ_ENABLED === 'true';
  }

  /**
   * Check if dual-write mode is enabled (Redis + RabbitMQ)
   */
  static isDualWriteEnabled(): boolean {
    return process.env.RABBITMQ_DUAL_WRITE === 'true';
  }

  /**
   * Check if dual-read mode is enabled (for consumers)
   */
  static isDualReadEnabled(): boolean {
    return process.env.RABBITMQ_DUAL_READ === 'true';
  }

  /**
   * Get RabbitMQ URL from environment
   */
  static getRabbitMQUrl(): string {
    return process.env.RABBITMQ_URL || 'amqp://solana:solana123@localhost:5672';
  }

  /**
   * Get RPC URLs (comma-separated list)
   */
  static getRpcUrls(): string[] {
    const urls = process.env.SOLANA_RPC_URLS;
    if (urls) {
      return urls.split(',').map(u => u.trim()).filter(u => u.length > 0);
    }
    // Fallback to single URL
    return [process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com'];
  }

  /**
   * Check if priority fee estimation is enabled
   */
  static isPriorityFeeEnabled(): boolean {
    return process.env.ENABLE_PRIORITY_FEES !== 'false';
  }

  /**
   * Get Jupiter API URL
   */
  static getJupiterApiUrl(): string {
    return process.env.JUPITER_API_URL || 'https://quote-api.jup.ag/v6';
  }

  /**
   * Get trading private key (base64 encoded)
   */
  static getTradingPrivateKey(): string | undefined {
    return process.env.TRADING_PRIVATE_KEY || process.env.SOLANA_PRIVATE_KEY;
  }

  /**
   * Get minimum burn threshold
   */
  static getMinBurnThreshold(): number {
    return Number(process.env.MIN_BURN_THRESHOLD || '1000000');
  }

  /**
   * Check if worker is running in development mode
   */
  static isDevelopment(): boolean {
    return process.env.NODE_ENV !== 'production';
  }

  /**
   * Get database URL
   */
  static getDatabaseUrl(): string {
    return process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/solana_eda';
  }

  /**
   * Get Redis URL
   */
  static getRedisUrl(): string {
    return process.env.REDIS_URL || 'redis://localhost:6379';
  }

  /**
   * Get worker name
   */
  static getWorkerName(): string {
    return process.env.WORKER_NAME || 'unknown-worker';
  }

  /**
   * Log current feature flag configuration
   */
  static logConfiguration(workerName: string): void {
    console.log(`[${workerName}] Feature Flags:`);
    console.log(`  RABBITMQ_ENABLED: ${this.isRabbitMQEnabled()}`);
    console.log(`  RABBITMQ_DUAL_WRITE: ${this.isDualWriteEnabled()}`);
    console.log(`  RABBITMQ_DUAL_READ: ${this.isDualReadEnabled()}`);
    console.log(`  ENABLE_PRIORITY_FEES: ${this.isPriorityFeeEnabled()}`);
    console.log(`  SOLANA_RPC_URLS: ${this.getRpcUrls().join(', ')}`);
    console.log(`  RabbitMQ URL: ${this.getRabbitMQUrl().replace(/:[^:@]+@/, ':****@')}`);
  }
}

/**
 * Worker Metrics for Monitoring
 */
export interface WorkerMetrics {
  eventsProcessed: number;
  errors: number;
  startTime: number;
  uptime: number;
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
 * Calculate worker uptime
 */
export function calculateUptime(startTime: number): number {
  return Date.now() - startTime;
}

/**
 * Format worker status event
 */
export function createWorkerStatusEvent(
  workerName: string,
  status: 'STARTING' | 'RUNNING' | 'STOPPING' | 'ERROR',
  metrics: WorkerMetrics
) {
  return {
    type: 'WORKER_STATUS' as const,
    timestamp: new Date().toISOString(),
    id: `${workerName}-status-${Date.now()}`,
    data: {
      workerName,
      status,
      metrics: {
        eventsProcessed: metrics.eventsProcessed,
        errors: metrics.errors,
        uptime: calculateUptime(metrics.startTime),
        lastEventAt: metrics.eventsProcessed > 0 ? new Date().toISOString() : undefined,
      },
    },
  };
}
