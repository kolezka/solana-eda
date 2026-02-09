/**
 * Jupiter API Pool
 *
 * Manages HTTP connections to Jupiter's quote API
 * Separate from RPC pool as Jupiter uses REST API, not WebSocket/RPC
 */

export interface JupiterEndpointConfig {
  url: string;
  priority: number; // Lower = higher priority
  maxRequests?: number;
  windowMs?: number;
}

export interface JupiterPoolConfig {
  endpoints: JupiterEndpointConfig[];
  healthCheckInterval?: number;
  requestTimeout?: number;
}

export interface JupiterQuoteRequest {
  inputMint: string;
  outputMint: string;
  amount: string | number;
  slippageBps?: number;
  swapMode?: 'ExactIn' | 'ExactOut';
  onlyDirectRoutes?: boolean;
  asLegacyTransaction?: boolean;
  maxAccounts?: number;
}

export interface JupiterEndpointStats {
  url: string;
  healthy: boolean;
  consecutiveErrors: number;
  consecutiveSuccesses: number;
  totalRequests: number;
  failedRequests: number;
  averageLatency: number;
  lastRequestTime?: Date;
  lastError?: string;
}

export class JupiterApiPool {
  private endpoints: Map<string, JupiterEndpointStats> = new Map();
  private healthCheckTimer?: NodeJS.Timeout;
  private config: JupiterPoolConfig;
  private rateLimiters: Map<string, RateLimiterState> = new Map();

  private readonly DEFAULT_HEALTH_CHECK_INTERVAL = 60000; // 1 minute
  private readonly DEFAULT_REQUEST_TIMEOUT = 10000; // 10 seconds
  private readonly DEFAULT_MAX_REQUESTS = 120; // Jupiter allows ~100 req/sec
  private readonly DEFAULT_WINDOW_MS = 1000;

  constructor(config: JupiterPoolConfig) {
    this.config = {
      healthCheckInterval: config.healthCheckInterval || this.DEFAULT_HEALTH_CHECK_INTERVAL,
      requestTimeout: config.requestTimeout || this.DEFAULT_REQUEST_TIMEOUT,
      endpoints: config.endpoints,
    };

    this.initializeEndpoints();
  }

  private initializeEndpoints(): void {
    // Sort by priority
    const sortedEndpoints = [...this.config.endpoints].sort((a, b) => a.priority - b.priority);

    for (const endpoint of sortedEndpoints) {
      this.endpoints.set(endpoint.url, {
        url: endpoint.url,
        healthy: true,
        consecutiveErrors: 0,
        consecutiveSuccesses: 0,
        totalRequests: 0,
        failedRequests: 0,
        averageLatency: 0,
      });

      this.rateLimiters.set(endpoint.url, {
        requests: [],
        maxRequests: endpoint.maxRequests || this.DEFAULT_MAX_REQUESTS,
        windowMs: endpoint.windowMs || this.DEFAULT_WINDOW_MS,
      });
    }

    console.log(`[JupiterApiPool] Initialized with ${this.endpoints.size} endpoints`);

    // Start health checks
    this.startHealthChecks();
  }

  /**
   * Get quote from Jupiter API with automatic failover
   */
  async getQuote(request: JupiterQuoteRequest): Promise<any> {
    const attemptedUrls: string[] = [];

    // Try endpoints in priority order
    const sortedUrls = Array.from(this.endpoints.entries())
      .sort(([, a], [, b]) => {
        // Prefer healthy endpoints
        if (a.healthy && !b.healthy) return -1;
        if (!a.healthy && b.healthy) return 1;
        // Then by consecutive errors
        return a.consecutiveErrors - b.consecutiveErrors;
      })
      .map(([url]) => url);

    for (const url of sortedUrls) {
      attemptedUrls.push(url);

      try {
        const result = await this.fetchWithRetry(url, '/quote', request);
        this.recordSuccess(url);
        return result;
      } catch (error: any) {
        this.recordFailure(url, error);
        // Try next endpoint
        continue;
      }
    }

    throw new Error(
      `[JupiterApiPool] All endpoints failed. Tried: ${attemptedUrls.join(', ')}`
    );
  }

  /**
   * Get swap transaction from Jupiter API
   */
  async getSwapTransaction(
    quoteResponse: any,
    userPublicKey: string,
    wrapAndUnwrapSol = true
  ): Promise<any> {
    const attemptedUrls: string[] = [];

    const sortedUrls = Array.from(this.endpoints.entries())
      .sort(([, a], [, b]) => {
        if (a.healthy && !b.healthy) return -1;
        if (!a.healthy && b.healthy) return 1;
        return a.consecutiveErrors - b.consecutiveErrors;
      })
      .map(([url]) => url);

    for (const url of sortedUrls) {
      attemptedUrls.push(url);

      try {
        const result = await this.fetchWithRetry(url, '/swap', {
          quoteResponse,
          userPublicKey,
          wrapAndUnwrapSol,
        });
        this.recordSuccess(url);
        return result;
      } catch (error: any) {
        this.recordFailure(url, error);
        continue;
      }
    }

    throw new Error(
      `[JupiterApiPool] All endpoints failed for swap. Tried: ${attemptedUrls.join(', ')}`
    );
  }

  /**
   * Fetch with rate limiting and retry
   */
  private async fetchWithRetry(
    baseUrl: string,
    path: string,
    body: any
  ): Promise<any> {
    const rateLimiter = this.rateLimiters.get(baseUrl);
    if (!rateLimiter) {
      throw new Error(`[JupiterApiPool] No rate limiter for ${baseUrl}`);
    }

    // Wait for rate limit
    await this.waitForRateLimit(rateLimiter);

    const url = `${baseUrl}${path}`;
    const startTime = Date.now();

    try {
      const response = await Promise.race([
        fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        }),
        new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), this.config.requestTimeout)
        ),
      ]);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } finally {
      const latency = Date.now() - startTime;
      this.updateLatency(baseUrl, latency);
    }
  }

  /**
   * Wait for rate limit if necessary
   */
  private async waitForRateLimit(rateLimiter: RateLimiterState): Promise<void> {
    const now = Date.now();

    // Remove old requests
    rateLimiter.requests = rateLimiter.requests.filter(
      (timestamp) => now - timestamp < rateLimiter.windowMs
    );

    // Check if we've hit the limit
    if (rateLimiter.requests.length >= rateLimiter.maxRequests) {
      const oldestRequest = rateLimiter.requests[0];
      if (oldestRequest !== undefined) {
        const waitTime = rateLimiter.windowMs - (now - oldestRequest);

        if (waitTime > 0) {
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }

    // Record this request
    rateLimiter.requests.push(Date.now());
  }

  /**
   * Record a successful request
   */
  private recordSuccess(url: string): void {
    const stats = this.endpoints.get(url);
    if (!stats) return;

    stats.consecutiveSuccesses++;
    stats.consecutiveErrors = 0;
    stats.totalRequests++;
    stats.healthy = true;
    stats.lastRequestTime = new Date();
  }

  /**
   * Record a failed request
   */
  private recordFailure(url: string, error: Error): void {
    const stats = this.endpoints.get(url);
    if (!stats) return;

    stats.consecutiveErrors++;
    stats.consecutiveSuccesses = 0;
    stats.totalRequests++;
    stats.failedRequests++;
    stats.lastError = error.message;
    stats.lastRequestTime = new Date();

    // Mark unhealthy after 3 consecutive errors
    if (stats.consecutiveErrors >= 3) {
      stats.healthy = false;
    }
  }

  /**
   * Update latency average
   */
  private updateLatency(url: string, latency: number): void {
    const stats = this.endpoints.get(url);
    if (!stats) return;

    if (stats.averageLatency === 0) {
      stats.averageLatency = latency;
    } else {
      stats.averageLatency = Math.round(stats.averageLatency * 0.9 + latency * 0.1);
    }
  }

  /**
   * Start health checks
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

    for (const url of this.endpoints.keys()) {
      checkPromises.push(this.checkEndpointHealth(url));
    }

    await Promise.allSettled(checkPromises);
  }

  /**
   * Check health of a single endpoint
   */
  private async checkEndpointHealth(url: string): Promise<void> {
    try {
      const rateLimiter = this.rateLimiters.get(url);
      if (rateLimiter) {
        await this.waitForRateLimit(rateLimiter);
      }

      await Promise.race([
        fetch(`${url}/quote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            inputMint: 'So11111111111111111111111111111111111111112', // SOL
            outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
            amount: '1000000',
          }),
        }),
        new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error('Health check timeout')), 5000)
        ),
      ]);

      // If we get here, endpoint is responding (even if quote fails, endpoint is up)
      const stats = this.endpoints.get(url);
      if (stats) {
        stats.consecutiveErrors = 0;
        stats.healthy = true;
      }
    } catch {
      // Health check failed, but don't mark unhealthy immediately
      // Let actual request failures do that
    }
  }

  /**
   * Get statistics for all endpoints
   */
  getStats(): JupiterEndpointStats[] {
    return Array.from(this.endpoints.values());
  }

  /**
   * Manually mark an endpoint as healthy
   */
  markEndpointHealthy(url: string): void {
    const stats = this.endpoints.get(url);
    if (stats) {
      stats.healthy = true;
      stats.consecutiveErrors = 0;
      console.log(`[JupiterApiPool] Marked ${url} as healthy`);
    }
  }

  /**
   * Reset all endpoint health
   */
  resetAllHealth(): void {
    for (const stats of this.endpoints.values()) {
      stats.healthy = true;
      stats.consecutiveErrors = 0;
      stats.consecutiveSuccesses = 0;
    }
    console.log('[JupiterApiPool] Reset all endpoint health statuses');
  }

  /**
   * Close the pool
   */
  async close(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    this.endpoints.clear();
    this.rateLimiters.clear();
    console.log('[JupiterApiPool] Pool closed');
  }
}

interface RateLimiterState {
  requests: number[];
  maxRequests: number;
  windowMs: number;
}

/**
 * Create Jupiter API pool from environment
 */
export function createJupiterPoolFromEnv(
  env: Record<string, string | undefined> = process.env
): JupiterApiPool {
  const jupiterApiUrl =
    env.JUPITER_API_URL || 'https://quote-api.jup.ag/v6';

  const endpoints: JupiterEndpointConfig[] = [
    {
      url: jupiterApiUrl,
      priority: 1,
    },
  ];

  // Add backup endpoints if configured
  const backupUrls = env.JUPITER_BACKUP_URLS?.split(',').map((u) => u.trim()) || [];
  backupUrls.forEach((url, index) => {
    endpoints.push({
      url,
      priority: index + 2,
    });
  });

  return new JupiterApiPool({
    endpoints,
    healthCheckInterval: parseInt(env.JUPITER_HEALTH_CHECK_INTERVAL || '60000', 10),
    requestTimeout: parseInt(env.JUPITER_REQUEST_TIMEOUT || '10000', 10),
  });
}
