import { Connection, type ConnectionConfig } from '@solana/web3.js';
import { RateLimiter, RPC_RATE_LIMITS } from './rate-limiter';

export type ConnectionType = 'query' | 'submit' | 'websocket' | 'jupiter-api';

export interface RpcEndpointConfig {
  url: string;
  priority: number; // Lower = higher priority (1 = highest)
  type?: ConnectionType[];
  weight?: number; // For weighted load balancing (default: 1)
  maxRequests?: number;
  windowMs?: number;
}

export interface ConnectionPoolConfig {
  endpoints: RpcEndpointConfig[];
  healthCheckInterval?: number;
  unhealthyThreshold?: number;
  healthyThreshold?: number;
  requestTimeout?: number;
}

export interface EndpointStats {
  url: string;
  healthy: boolean;
  consecutiveErrors: number;
  consecutiveSuccesses: number;
  totalRequests: number;
  failedRequests: number;
  averageLatency: number;
  lastHealthCheck?: Date;
  lastError?: string;
  lastErrorTime?: Date;
}

export interface PooledConnection {
  connection: Connection;
  config: RpcEndpointConfig;
  stats: EndpointStats;
  rateLimiter: RateLimiter;
  activeRequests: number;
}

/**
 * RPC Connection Pool with Health Checking and Failover
 *
 * Features:
 * - Multiple endpoint management with priority-based selection
 * - Automatic health checking with configurable thresholds
 * - Per-endpoint rate limiting
 * - Weighted round-robin load balancing
 * - Automatic failover on errors
 * - Latency-based endpoint selection
 */
export class RpcConnectionPool {
  private pools: Map<ConnectionType, PooledConnection[]> = new Map();
  private healthCheckTimer?: NodeJS.Timeout;
  private config: ConnectionPoolConfig;

  // Configuration defaults
  private readonly DEFAULT_HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly DEFAULT_UNHEALTHY_THRESHOLD = 3;
  private readonly DEFAULT_HEALTHY_THRESHOLD = 2;
  private readonly DEFAULT_REQUEST_TIMEOUT = 10000; // 10 seconds

  constructor(config: ConnectionPoolConfig) {
    this.config = {
      healthCheckInterval: config.healthCheckInterval || this.DEFAULT_HEALTH_CHECK_INTERVAL,
      unhealthyThreshold: config.unhealthyThreshold || this.DEFAULT_UNHEALTHY_THRESHOLD,
      healthyThreshold: config.healthyThreshold || this.DEFAULT_HEALTHY_THRESHOLD,
      requestTimeout: config.requestTimeout || this.DEFAULT_REQUEST_TIMEOUT,
      endpoints: config.endpoints,
    };

    this.initializePools();
    this.startHealthChecks();
  }

  /**
   * Initialize connection pools for each connection type
   */
  private initializePools(): void {
    // Create pools for each type
    const types: ConnectionType[] = ['query', 'submit', 'websocket', 'jupiter-api'];

    for (const type of types) {
      this.pools.set(type, []);
    }

    // Add endpoints to appropriate pools
    for (const endpoint of this.config.endpoints) {
      const types = endpoint.type || ['query'];

      for (const type of types) {
        if (type === 'jupiter-api') continue; // Jupiter is HTTP API, not RPC

        const pool = this.pools.get(type);
        if (!pool) continue;

        // Get rate limit config
        const rateLimitConfig = this.getRateLimitConfig(endpoint.url, endpoint);

        // Create connection
        const connectionConfig: ConnectionConfig = {
          commitment: 'confirmed',
          disableRetryOnRateLimit: false,
          httpHeaders: endpoint.url.includes('helius')
            ? { 'Connection': 'keep-alive' }
            : undefined,
        };

        const connection = new Connection(endpoint.url, connectionConfig);

        const pooledConnection: PooledConnection = {
          connection,
          config: endpoint,
          rateLimiter: new RateLimiter(rateLimitConfig),
          activeRequests: 0,
          stats: {
            url: endpoint.url,
            healthy: true,
            consecutiveErrors: 0,
            consecutiveSuccesses: 0,
            totalRequests: 0,
            failedRequests: 0,
            averageLatency: 0,
            lastHealthCheck: new Date(),
          },
        };

        // Insert in priority order
        const insertIndex = pool.findIndex(
          (pc) => pc.config.priority !== undefined && pc.config.priority > (endpoint.priority || 99)
        );
        if (insertIndex === -1) {
          pool.push(pooledConnection);
        } else {
          pool.splice(insertIndex, 0, pooledConnection);
        }

        this.pools.set(type, pool);
      }
    }

    console.log(`[RpcConnectionPool] Initialized pools:`, {
      query: this.pools.get('query')?.length || 0,
      submit: this.pools.get('submit')?.length || 0,
      websocket: this.pools.get('websocket')?.length || 0,
    });
  }

  /**
   * Get rate limit config for endpoint
   */
  private getRateLimitConfig(
    url: string,
    endpoint: RpcEndpointConfig
  ): { maxRequests: number; windowMs: number } {
    // Use endpoint-specific config if provided
    if (endpoint.maxRequests && endpoint.windowMs) {
      return { maxRequests: endpoint.maxRequests, windowMs: endpoint.windowMs };
    }

    // Check for known RPC providers
    for (const [domain, config] of Object.entries(RPC_RATE_LIMITS)) {
      if (url.includes(domain)) {
        return config;
      }
    }

    // Default conservative rate limit
    return { maxRequests: 50, windowMs: 1000 };
  }

  /**
   * Get a connection from the specified pool
   * Implements weighted selection based on health, latency, and priority
   */
  getConnection(type: ConnectionType): Connection {
    const pool = this.pools.get(type);
    if (!pool || pool.length === 0) {
      throw new Error(`[RpcConnectionPool] No connections available for type: ${type}`);
    }

    // Filter for healthy connections
    const healthyConnections = pool.filter((pc) => pc.stats.healthy);

    if (healthyConnections.length === 0) {
      // All connections unhealthy, reset and try least unhealthy
      const leastUnhealthy = pool.sort((a, b) => a.stats.consecutiveErrors - b.stats.consecutiveErrors)[0];
      if (!leastUnhealthy) {
        throw new Error(`[RpcConnectionPool] No connections available for type: ${type}`);
      }
      console.warn(
        `[RpcConnectionPool] No healthy ${type} connections, using ${leastUnhealthy.stats.url}`
      );
      return leastUnhealthy.connection;
    }

    // Weighted selection based on:
    // 1. Priority (already sorted)
    // 2. Health (consecutive successes vs errors)
    // 3. Latency (prefer faster)
    // 4. Current load (active requests)

    let bestConnection: PooledConnection | undefined = healthyConnections[0];
    let bestScore = -Infinity;

    for (const pc of healthyConnections) {
      const score = this.calculateConnectionScore(pc);
      if (score > bestScore) {
        bestScore = score;
        bestConnection = pc;
      }
    }

    // Fallback to first healthy connection if scoring failed
    if (!bestConnection && healthyConnections.length > 0) {
      bestConnection = healthyConnections[0];
    }

    if (!bestConnection) {
      throw new Error(`[RpcConnectionPool] Failed to select connection for type: ${type}`);
    }

    return bestConnection.connection;
  }

  /**
   * Calculate a score for connection selection
   * Higher score = better connection
   */
  private calculateConnectionScore(pc: PooledConnection): number {
    const {
      consecutiveSuccesses,
      consecutiveErrors,
      averageLatency,
      totalRequests,
    } = pc.stats;

    // Base score from health
    let score = consecutiveSuccesses * 10 - consecutiveErrors * 20;

    // Latency bonus (lower is better)
    if (averageLatency > 0) {
      score += Math.max(0, 1000 - averageLatency);
    }

    // Load penalty
    score -= pc.activeRequests * 50;

    // Stability bonus for endpoints with many requests
    if (totalRequests > 100) {
      score += 20;
    }

    return score;
  }

  /**
   * Execute a request with automatic failover and retry
   */
  async executeWithRetry<T>(
    type: ConnectionType,
    fn: (connection: Connection) => Promise<T>,
    options: { maxRetries?: number; skipHealthCheckOnRetry?: boolean } = {}
  ): Promise<T> {
    const { maxRetries = 3, skipHealthCheckOnRetry = false } = options;
    let lastError: Error | null = null;
    const attemptedUrls: string[] = [];

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const connection = this.getConnection(type);
      const pooledConn = this.findPooledConnection(connection, type);

      if (!pooledConn) {
        throw new Error(`[RpcConnectionPool] Connection not found in pool`);
      }

      attemptedUrls.push(pooledConn.stats.url);
      pooledConn.activeRequests++;
      pooledConn.stats.totalRequests++;

      const startTime = Date.now();

      try {
        const result = await Promise.race([
          fn(connection),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), this.config.requestTimeout)
          ),
        ]);

        // Success - update stats
        const latency = Date.now() - startTime;
        this.recordSuccess(pooledConn, latency);

        return result;
      } catch (error: any) {
        const latency = Date.now() - startTime;
        this.recordFailure(pooledConn, error);

        lastError = error;

        // Don't retry on certain errors
        const shouldNotRetry =
          error.message?.includes('Invalid params') ||
          error.message?.includes('Account not found') ||
          error.message?.includes('Block not found');

        if (shouldNotRetry) {
          throw error;
        }

        // Try next endpoint on retry
        if (attempt < maxRetries - 1) {
          // Brief backoff
          await new Promise((resolve) => setTimeout(resolve, 100 * (attempt + 1)));
        }
      } finally {
        pooledConn.activeRequests--;
      }
    }

    throw new Error(
      `[RpcConnectionPool] All ${maxRetries} attempts failed. Tried URLs: ${attemptedUrls.join(', ')}. Last error: ${lastError?.message}`
    );
  }

  /**
   * Record a successful request
   */
  private recordSuccess(pc: PooledConnection, latency: number): void {
    pc.stats.consecutiveSuccesses++;
    pc.stats.consecutiveErrors = 0;

    // Update average latency (exponential moving average)
    if (pc.stats.averageLatency === 0) {
      pc.stats.averageLatency = latency;
    } else {
      pc.stats.averageLatency = Math.round(pc.stats.averageLatency * 0.9 + latency * 0.1);
    }

    // Mark healthy if threshold reached
    if (
      !pc.stats.healthy &&
      pc.stats.consecutiveSuccesses >= (this.config.healthyThreshold || this.DEFAULT_HEALTHY_THRESHOLD)
    ) {
      pc.stats.healthy = true;
      console.log(`[RpcConnectionPool] Endpoint ${pc.stats.url} is now healthy`);
    }
  }

  /**
   * Record a failed request
   */
  private recordFailure(pc: PooledConnection, error: Error): void {
    pc.stats.consecutiveErrors++;
    pc.stats.consecutiveSuccesses = 0;
    pc.stats.failedRequests++;
    pc.stats.lastError = error.message;
    pc.stats.lastErrorTime = new Date();

    // Mark unhealthy if threshold reached
    if (
      pc.stats.healthy &&
      pc.stats.consecutiveErrors >= (this.config.unhealthyThreshold || this.DEFAULT_UNHEALTHY_THRESHOLD)
    ) {
      pc.stats.healthy = false;
      console.warn(
        `[RpcConnectionPool] Endpoint ${pc.stats.url} marked as unhealthy after ${pc.stats.consecutiveErrors} consecutive errors`
      );
    }
  }

  /**
   * Find pooled connection by Connection instance
   */
  private findPooledConnection(connection: Connection, type: ConnectionType): PooledConnection | undefined {
    const pool = this.pools.get(type);
    return pool?.find((pc) => pc.connection === connection);
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.healthCheckInterval || this.DEFAULT_HEALTH_CHECK_INTERVAL);
  }

  /**
   * Perform health checks on all endpoints
   */
  private async performHealthChecks(): Promise<void> {
    const checkPromises: Promise<void>[] = [];

    for (const [type, pool] of this.pools.entries()) {
      for (const pc of pool) {
        checkPromises.push(this.checkEndpointHealth(pc, type));
      }
    }

    await Promise.allSettled(checkPromises);
  }

  /**
   * Check health of a single endpoint
   */
  private async checkEndpointHealth(pc: PooledConnection, type: ConnectionType): Promise<void> {
    if (type === 'jupiter-api') return; // Skip Jupiter API health check

    const startTime = Date.now();

    try {
      await Promise.race([
        pc.connection.getVersion(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), 5000)
        ),
      ]);

      const latency = Date.now() - startTime;
      this.recordSuccess(pc, latency);
      pc.stats.lastHealthCheck = new Date();
    } catch (error: any) {
      this.recordFailure(pc, error);
      pc.stats.lastHealthCheck = new Date();
    }
  }

  /**
   * Get statistics for all pools
   */
  getPoolStats(): Map<ConnectionType, EndpointStats[]> {
    const stats = new Map<ConnectionType, EndpointStats[]>();

    for (const [type, pool] of this.pools.entries()) {
      stats.set(type, pool.map((pc) => ({ ...pc.stats })));
    }

    return stats;
  }

  /**
   * Get statistics for a specific pool type
   */
  getStatsForType(type: ConnectionType): EndpointStats[] {
    const pool = this.pools.get(type);
    return pool ? pool.map((pc) => ({ ...pc.stats })) : [];
  }

  /**
   * Manually mark an endpoint as healthy (for recovery)
   */
  markEndpointHealthy(url: string, type?: ConnectionType): void {
    const types = type ? [type] : (Array.from(this.pools.keys()) as ConnectionType[]);

    for (const t of types) {
      const pool = this.pools.get(t);
      if (!pool) continue;

      const pc = pool.find((p) => p.stats.url === url);
      if (pc) {
        pc.stats.healthy = true;
        pc.stats.consecutiveErrors = 0;
        console.log(`[RpcConnectionPool] Manually marked ${url} as healthy for ${t}`);
      }
    }
  }

  /**
   * Reset all endpoint health (emergency recovery)
   */
  resetAllHealth(): void {
    for (const pool of this.pools.values()) {
      for (const pc of pool) {
        pc.stats.healthy = true;
        pc.stats.consecutiveErrors = 0;
        pc.stats.consecutiveSuccesses = 0;
      }
    }
    console.log('[RpcConnectionPool] Reset all endpoint health statuses');
  }

  /**
   * Close all connections and stop health checks
   */
  async close(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    this.pools.clear();
    console.log('[RpcConnectionPool] Pool closed');
  }
}

/**
 * Create RPC pool from environment variables
 */
export function createRpcPoolFromEnv(
  env: Record<string, string | undefined> = process.env
): RpcConnectionPool {
  const rpcUrls = env.SOLANA_RPC_URLS?.split(',').map((u) => u.trim()) || [];
  const primaryRpc = env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

  // Build endpoint configs
  const endpoints: RpcEndpointConfig[] = [];

  // Add primary RPC (highest priority)
  endpoints.push({
    url: primaryRpc,
    priority: 1,
    type: ['query', 'submit', 'websocket'],
  });

  // Add additional RPCs
  rpcUrls.forEach((url, index) => {
    if (url !== primaryRpc) {
      endpoints.push({
        url,
        priority: index + 2,
        type: ['query', 'submit'],
      });
    }
  });

  // Add public fallback
  if (!primaryRpc.includes('api.mainnet-beta.solana.com')) {
    endpoints.push({
      url: 'https://api.mainnet-beta.solana.com',
      priority: 99,
      type: ['query'],
      maxRequests: 10, // Conservative rate limit for public endpoint
      windowMs: 1000,
    });
  }

  return new RpcConnectionPool({
    endpoints,
    healthCheckInterval: parseInt(env.SOLANA_RPC_HEALTH_CHECK_INTERVAL || '30000', 10),
  });
}
