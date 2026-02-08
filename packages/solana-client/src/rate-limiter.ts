/**
 * Rate limiter for Solana RPC calls
 * Prevents hitting rate limits on public RPC endpoints
 */

export interface RateLimiterOptions {
  maxRequests: number;
  windowMs: number;
}

export class RateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(options: RateLimiterOptions) {
    this.maxRequests = options.maxRequests;
    this.windowMs = options.windowMs;
  }

  /**
   * Check if request is allowed and wait if necessary
   */
  async throttle(): Promise<void> {
    const now = Date.now();

    // Remove old requests outside the window
    this.requests = this.requests.filter(
      timestamp => now - timestamp < this.windowMs
    );

    // Check if we've hit the limit
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      if (oldestRequest !== undefined) {
        const waitTime = this.windowMs - (now - oldestRequest);

        if (waitTime > 0) {
          console.debug(`[RateLimiter] Rate limit reached, waiting ${waitTime}ms`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    // Record this request
    this.requests.push(Date.now());
  }

  /**
   * Get current usage statistics
   */
  getStats() {
    const now = Date.now();
    const recentRequests = this.requests.filter(
      timestamp => now - timestamp < this.windowMs
    );

    return {
      used: recentRequests.length,
      limit: this.maxRequests,
      available: this.maxRequests - recentRequests.length,
      resetTime: recentRequests.length > 0 && recentRequests[0] !== undefined
        ? recentRequests[0] + this.windowMs
        : now,
    };
  }

  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.requests = [];
  }
}

/**
 * Pre-configured rate limiters for common RPC providers
 */
export const RPC_RATE_LIMITS: Record<string, RateLimiterOptions> = {
  // Public endpoints
  'api.mainnet-beta.solana.com': { maxRequests: 20, windowMs: 1000 }, // 20 req/sec
  'api.devnet.solana.com': { maxRequests: 20, windowMs: 1000 },

  // QuickNode
  'solana-mainnet.quiknode.pro': { maxRequests: 100, windowMs: 1000 },

  // Helius
  'rpc.helius.xyz': { maxRequests: 100, windowMs: 1000 },

  // Triton
  'rpc.ankr.com': { maxRequests: 50, windowMs: 1000 },

  // Genesis (default)
  'default': { maxRequests: 50, windowMs: 1000 },
};
