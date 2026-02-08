import { Connection, PublicKey } from '@solana/web3.js';
import type { AccountInfo, ParsedAccountData } from '@solana/web3.js';
import { RateLimiter, RPC_RATE_LIMITS } from './rate-limiter';

/**
 * Batch client for efficient Solana RPC queries
 * Groups multiple requests into single batched calls
 */
export class BatchClient {
  private connection: Connection;
  private rateLimiter: RateLimiter;
  private batchSize: number;

  constructor(
    connection: Connection,
    rpcUrl: string,
    options: { batchSize?: number; rateLimit?: { maxRequests: number; windowMs: number } } = {}
  ) {
    this.connection = connection;
    this.batchSize = options.batchSize || 100;

    // Set up rate limiting
    const rateLimitKey = Object.keys(RPC_RATE_LIMITS).find(key => rpcUrl.includes(key)) || 'default';
    const rateLimitConfig = options.rateLimit ?? RPC_RATE_LIMITS[rateLimitKey];
    this.rateLimiter = new RateLimiter(rateLimitConfig || { maxRequests: 10, windowMs: 1000 });
  }

  /**
   * Batch fetch account info for multiple public keys
   */
  async getBatchAccountInfo(
    publicKeys: PublicKey[]
  ): Promise<(AccountInfo<Buffer> | null)[]> {
    await this.rateLimiter.throttle();

    const results: (AccountInfo<Buffer> | null)[] = [];

    // Process in batches
    for (let i = 0; i < publicKeys.length; i += this.batchSize) {
      const batch = publicKeys.slice(i, i + this.batchSize);

      try {
        const accounts = await this.connection.getMultipleAccountsInfo(batch);
        results.push(...accounts);
      } catch (error) {
        console.error('[BatchClient] Error fetching batch accounts:', error);
        // Fill with nulls for failed batch
        results.push(...new Array(batch.length).fill(null));
      }
    }

    return results;
  }

  /**
   * Batch fetch parsed account data
   */
  async getBatchParsedAccounts(
    publicKeys: PublicKey[]
  ): Promise<(ParsedAccountData | null)[]> {
    await this.rateLimiter.throttle();

    const results: (ParsedAccountData | null)[] = [];

    for (let i = 0; i < publicKeys.length; i += this.batchSize) {
      const batch = publicKeys.slice(i, i + this.batchSize);

      try {
        const accounts = await this.connection.getMultipleAccountsInfo(batch);
        results.push(...accounts.map((acc): ParsedAccountData | null => {
          if (!acc) return null;
          // For now, return null for non-parsed accounts
          // In production, you'd parse based on account owner
          return null;
        }));
      } catch (error) {
        console.error('[BatchClient] Error fetching batch parsed accounts:', error);
        results.push(...new Array(batch.length).fill(null));
      }
    }

    return results;
  }

  /**
   * Batch fetch token account balances
   */
  async getBatchTokenBalances(
    tokenAccounts: PublicKey[]
  ): Promise<Array<{ amount: string; decimals: number; uiAmount: number } | null>> {
    await this.rateLimiter.throttle();

    const results = [];

    for (let i = 0; i < tokenAccounts.length; i += this.batchSize) {
      const batch = tokenAccounts.slice(i, i + this.batchSize);

      try {
        const balances = await Promise.all(
          batch.map(account => this.connection.getTokenAccountBalance(account))
        );
        results.push(...balances);
      } catch (error) {
        console.error('[BatchClient] Error fetching batch token balances:', error);
        results.push(...new Array(batch.length).fill(null));
      }
    }

    return results;
  }

  /**
   * Batch fetch SOL balances
   */
  async getBatchBalances(publicKeys: PublicKey[]): Promise<number[]> {
    await this.rateLimiter.throttle();

    const results: number[] = [];

    for (let i = 0; i < publicKeys.length; i += this.batchSize) {
      const batch = publicKeys.slice(i, i + this.batchSize);

      try {
        const balances = await Promise.all(
          batch.map(key => this.connection.getBalance(key))
        );
        results.push(...balances);
      } catch (error) {
        console.error('[BatchClient] Error fetching batch balances:', error);
        results.push(...new Array(batch.length).fill(0));
      }
    }

    return results;
  }

  /**
   * Batch fetch signatures for accounts
   */
  async getBatchSignatures(
    publicKeys: PublicKey[],
    options: { limit?: number; before?: string; until?: string } = {}
  ): Promise<Array<string[]>> {
    await this.rateLimiter.throttle();

    const results: string[][] = [];

    for (let i = 0; i < publicKeys.length; i += Math.min(this.batchSize, 5)) {
      // Smaller batch for signatures
      const batch = publicKeys.slice(i, i + Math.min(this.batchSize, 5));

      try {
        const signatures = await Promise.all(
          batch.map(key =>
            this.connection.getSignaturesForAddress(key, {
              limit: options.limit || 10,
              before: options.before,
              until: options.until,
            })
          )
        );
        results.push(signatures.flatMap(sig => sig.map(s => s.signature)));
      } catch (error) {
        console.error('[BatchClient] Error fetching batch signatures:', error);
        results.push(...new Array(batch.length).fill([]));
      }
    }

    return results;
  }

  /**
   * Get rate limiter stats
   */
  getRateLimitStats() {
    return this.rateLimiter.getStats();
  }
}

/**
 * Connection pool with failover support
 */
export class ConnectionPool {
  private connections: Array<{ connection: Connection; url: string; errors: number; available: boolean }>;
  private currentIndex = 0;

  constructor(rpcUrls: string[]) {
    this.connections = rpcUrls.map(url => ({
      connection: new Connection(url, 'confirmed'),
      url,
      errors: 0,
      available: true,
    }));

    console.log(`[ConnectionPool] Initialized with ${rpcUrls.length} RPC endpoints`);
  }

  /**
   * Get a healthy connection
   */
  getConnection(): Connection {
    // Find the first available connection with the fewest errors
    const available = this.connections.filter(c => c.available);

    if (available.length === 0) {
      console.warn('[ConnectionPool] No available connections, resetting all');
      this.connections.forEach(c => {
        c.available = true;
        c.errors = 0;
      });
      const first = this.connections[0];
      if (!first) {
        throw new Error('[ConnectionPool] No connections available');
      }
      return first.connection;
    }

    // Sort by errors and pick the best
    const sorted = [...available].sort((a, b) => a.errors - b.errors);
    const best = sorted[0];
    if (!best) {
      throw new Error('[ConnectionPool] No available connection after sorting');
    }
    return best.connection;
  }

  /**
   * Mark a connection as failed
   */
  markFailure(connection: Connection): void {
    const conn = this.connections.find(c => c.connection === connection);
    if (!conn) return;

    conn.errors++;

    // Disable connection if too many errors
    if (conn.errors >= 10) {
      console.warn(`[ConnectionPool] Disabling RPC endpoint: ${conn.url}`);
      conn.available = false;
    }
  }

  /**
   * Reset error counts
   */
  resetErrors(): void {
    this.connections.forEach(c => {
      c.errors = 0;
      c.available = true;
    });
  }

  /**
   * Get connection stats
   */
  getStats() {
    return this.connections.map(c => ({
      url: c.url,
      errors: c.errors,
      available: c.available,
    }));
  }

  /**
   * Close all connections
   */
  async closeAll(): Promise<void> {
    await Promise.all(
      this.connections.map(async c => {
        try {
          // Connection doesn't have a close method in newer versions
          // Just clean up references
          c.available = false;
        } catch (error) {
          console.error('[ConnectionPool] Error closing connection:', error);
        }
      })
    );
  }
}
