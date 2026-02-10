import Redis from 'ioredis';
import type { RedisOptions } from 'ioredis';

/**
 * Queue configuration options
 */
export interface QueueConfig {
  /** Redis connection configuration */
  redis: {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    url?: string;
  };
  /** Default job options for all queues */
  defaultJobOptions?: {
    attempts?: number;
    backoff?: {
      type: 'exponential' | 'fixed' | 'custom';
      delay?: number;
    };
    removeOnComplete?: number;
    removeOnFail?: number;
    timeout?: number;
  };
  /** Connection pool settings */
  connectionPool?: {
    maxRetriesPerRequest?: number | null;
    enableReadyCheck?: boolean;
    maxRetryStrategy?: (times: number) => number | void;
  };
}

/**
 * Default queue configuration
 */
const DEFAULT_CONFIG: QueueConfig = {
  redis: {
    host: 'localhost',
    port: 6379,
    db: 0,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  },
  connectionPool: {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  },
};

/**
 * Load queue configuration from environment or defaults
 */
export function loadQueueConfig(): QueueConfig {
  const config: QueueConfig = {
    ...DEFAULT_CONFIG,
    redis: {
      ...DEFAULT_CONFIG.redis,
    },
  };

  // Use Redis URL from environment if available
  const redisUrl = process.env.REDIS_URL || process.env.BULLMQ_REDIS_URL;
  if (redisUrl) {
    config.redis.url = redisUrl;
  }

  return config;
}

/**
 * Create a Redis connection for BullMQ
 * Uses a singleton pattern to share connection across all queues
 */
let redisConnection: Redis | null = null;

export function createRedisConnection(config?: QueueConfig): Redis {
  if (redisConnection) {
    return redisConnection;
  }

  const queueConfig = config || loadQueueConfig();
  const { redis: redisConfig, connectionPool } = queueConfig;

  const redisOptions: RedisOptions = {
    maxRetriesPerRequest: connectionPool?.maxRetriesPerRequest ?? null,
    enableReadyCheck: connectionPool?.enableReadyCheck ?? false,
    retryStrategy: connectionPool?.maxRetryStrategy,
  };

  if (redisConfig.url) {
    redisConnection = new Redis(redisConfig.url, redisOptions);
  } else {
    redisConnection = new Redis({
      host: redisConfig.host || 'localhost',
      port: redisConfig.port || 6379,
      password: redisConfig.password,
      db: redisConfig.db || 0,
      ...redisOptions,
    });
  }

  redisConnection.on('error', (err) => {
    console.error('[Queue] Redis connection error:', err);
  });

  redisConnection.on('connect', () => {
    console.log('[Queue] Redis connected');
  });

  redisConnection.on('disconnect', () => {
    console.warn('[Queue] Redis disconnected');
  });

  return redisConnection;
}

/**
 * Get the existing Redis connection or create a new one
 */
export function getRedisConnection(): Redis {
  if (!redisConnection) {
    return createRedisConnection();
  }
  return redisConnection;
}

/**
 * Close the Redis connection
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
  }
}

/**
 * Create a Redis connection for a separate worker process
 * This ensures each process has its own connection
 */
export function createWorkerRedisConnection(config?: QueueConfig): Redis {
  const queueConfig = config || loadQueueConfig();
  const { redis: redisConfig, connectionPool } = queueConfig;

  const redisOptions: RedisOptions = {
    maxRetriesPerRequest: null,
    enableReadyCheck: connectionPool?.enableReadyCheck ?? false,
    retryStrategy: connectionPool?.maxRetryStrategy,
  };

  if (redisConfig.url) {
    return new Redis(redisConfig.url, redisOptions);
  }

  return new Redis({
    host: redisConfig.host || 'localhost',
    port: redisConfig.port || 6379,
    password: redisConfig.password,
    db: redisConfig.db || 0,
    ...redisOptions,
  });
}
