import { Connection, PublicKey } from '@solana/web3.js';
import type { AccountInfo, Context } from '@solana/web3.js';
import { RateLimiter, RPC_RATE_LIMITS } from './rate-limiter';

export type CommitmentLevel = 'processed' | 'confirmed' | 'finalized';

export interface ConnectionConfig {
  rpcUrl: string;
  wsUrl?: string;
  commitment?: CommitmentLevel;
  httpHeaders?: Record<string, string>;
  disableRetryOnRateLimit?: boolean;
}

/**
 * Manages Solana RPC and WebSocket connections with proper lifecycle
 */
export class SolanaConnectionManager {
  private connection: Connection;
  private wsConnection: Connection | null = null;

  private rateLimiter: RateLimiter;
  private wsConnected: boolean = false;
  private autoReconnect: boolean = false;

  constructor(private config: ConnectionConfig) {
    // Create rate limiter
    const rateLimitConfig = this.getRateLimitConfig(this.config.rpcUrl);
    this.rateLimiter = new RateLimiter(rateLimitConfig);

    this.connection = new Connection(this.config.rpcUrl, {
      commitment: 'confirmed',
      disableRetryOnRateLimit: this.config.disableRetryOnRateLimit,
    });

    if (this.config.wsUrl) {
      this.wsConnection = new Connection(this.config.rpcUrl, {
        commitment: 'confirmed',
        wsEndpoint: this.config.wsUrl,
        disableRetryOnRateLimit: this.config.disableRetryOnRateLimit,
      });
    }
  }

  /**
   * Get rate limit config based on RPC URL
   */
  private getRateLimitConfig(rpcUrl: string): { maxRequests: number; windowMs: number } {
    // Check for known RPC providers
    for (const [domain, config] of Object.entries(RPC_RATE_LIMITS)) {
      if (rpcUrl.includes(domain)) {
        console.log(`[SolanaConnection] Using rate limit config for ${domain}:`, config);
        return config;
      }
    }

    // Default conservative rate limit for unknown endpoints
    console.log(
      `[SolanaConnection] Using default rate limit: 10 req/sec (conservative for public endpoints)`,
    );
    return { maxRequests: 10, windowMs: 1000 };
  }

  /**
   * Get the HTTP RPC connection
   */
  getConnection(): Connection {
    return this.connection;
  }

  /**
   * Get the WebSocket connection
   * Returns null if no WebSocket connection is available
   */
  getWsConnection(): Connection | null {
    return this.wsConnection;
  }

  /**
   * Check if WebSocket connection is available and connected
   */
  isWsConnected(): boolean {
    return this.wsConnection !== null && this.wsConnected;
  }

  /**
   * Get the WebSocket URL
   */
  getWsUrl(): string | undefined {
    return this.config.wsUrl;
  }

  /**
   * Get the RPC URL
   */
  getRpcUrl(): string {
    return this.config.rpcUrl;
  }

  /**
   * Establish WebSocket connection
   */
  async connectWebSocket(): Promise<void> {
    const wsUrl = this.getWsUrl();
    if (!wsUrl) {
      throw new Error('No WebSocket URL available - cannot derive from RPC URL');
    }

    try {
      this.wsConnection = new Connection(wsUrl, this.config.commitment || 'confirmed');

      // Verify connection
      await this.wsConnection.getVersion();
      this.wsConnected = true;

      console.log(`[SolanaConnection] WebSocket connected to ${wsUrl}`);
    } catch (error) {
      console.error('[SolanaConnection] WebSocket connection failed:', error);
      this.wsConnected = false;
      throw error;
    }
  }

  /**
   * Enable auto-reconnect for WebSocket
   */
  setAutoReconnect(enabled: boolean): void {
    this.autoReconnect = enabled;
  }

  /**
   * Execute a function with rate limiting
   */
  private async withRateLimit<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.config.disableRetryOnRateLimit) {
      await this.rateLimiter.throttle();
    }
    return await fn();
  }

  /**
   * Subscribe to account changes via WebSocket
   * Requires WebSocket connection - throws if not available
   */
  onAccountChange(
    publicKey: PublicKey,
    callback: (accountInfo: AccountInfo<Buffer> | null, context: Context) => void,
    commitment?: CommitmentLevel,
  ): number {
    const conn = this.getWsConnectionOrThrow();
    return conn.onAccountChange(publicKey, callback, commitment);
  }

  /**
   * Remove account change listener
   */
  removeAccountChangeListener(subscriptionId: number): void {
    const conn = this.wsConnection || this.connection;
    conn.removeAccountChangeListener(subscriptionId);
  }

  /**
   * Subscribe to logs via WebSocket
   * Requires WebSocket connection - throws if not available
   */
  onLogs(
    filter: any,
    callback: (logs: any, context: any) => void,
    commitment?: CommitmentLevel,
  ): number {
    const conn = this.getWsConnectionOrThrow();
    return conn.onLogs(filter, callback, commitment);
  }

  /**
   * Remove logs subscription
   */
  removeOnLogsListener(subscriptionId: number): void {
    const conn = this.wsConnection || this.connection;
    conn.removeOnLogsListener(subscriptionId);
  }

  /**
   * Get WebSocket connection or throw if not available
   */
  private getWsConnectionOrThrow(): Connection {
    if (!this.wsConnection) {
      throw new Error(
        'WebSocket connection not available. Please provide SOLANA_WS_URL or use a provider that supports WebSocket connections.',
      );
    }

    if (!this.wsConnected && this.autoReconnect) {
      // Attempt to reconnect asynchronously
      this.connectWebSocket().catch((error) => {
        console.warn('[SolanaConnection] Auto-reconnect failed:', error);
      });
    }

    return this.wsConnection;
  }

  /**
   * Get account info with rate limiting
   */
  async getAccountInfo(publicKey: PublicKey): Promise<AccountInfo<Buffer> | null> {
    return await this.withRateLimit(async () => {
      return await this.connection.getAccountInfo(publicKey);
    });
  }

  /**
   * Get multiple accounts with rate limiting (counts as 1 request)
   */
  async getMultipleAccounts(publicKeys: PublicKey[]): Promise<(AccountInfo<Buffer> | null)[]> {
    return await this.withRateLimit(async () => {
      return await this.connection.getMultipleAccountsInfo(publicKeys);
    });
  }

  /**
   * Get transaction details with rate limiting
   */
  async getTransaction(signature: string): Promise<any | null> {
    return await this.withRateLimit(async () => {
      return await this.connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      });
    });
  }

  /**
   * Get multiple transactions in batch (more efficient than individual calls)
   */
  async getTransactions(signatures: string[]): Promise<(any | null)[]> {
    return await Promise.all(signatures.map((sig) => this.getTransaction(sig).catch((e) => null)));
  }

  /**
   * Get latest blockhash
   */
  async getLatestBlockhash(): Promise<{ blockhash: string }> {
    return await this.connection.getLatestBlockhash();
  }

  /**
   * Send raw transaction
   */
  async sendRawTransaction(
    transaction: Buffer,
    options?: { skipPreflight?: boolean; maxRetries?: number },
  ): Promise<string> {
    return await this.connection.sendRawTransaction(transaction, options);
  }

  /**
   * Confirm transaction
   */
  async confirmTransaction(signature: string, commitment?: CommitmentLevel): Promise<any> {
    return await this.connection.confirmTransaction(signature, commitment);
  }

  /**
   * Get balance
   */
  async getBalance(publicKey: PublicKey): Promise<number> {
    return await this.connection.getBalance(publicKey);
  }

  /**
   * Get token account balance
   */
  async getTokenAccountBalance(
    tokenAccount: PublicKey,
  ): Promise<{ amount: string; decimals: number; uiAmount: number }> {
    const response = await this.connection.getTokenAccountBalance(tokenAccount);
    return {
      amount: response.value.amount,
      decimals: response.value.decimals,
      uiAmount: response.value.uiAmount || 0,
    };
  }

  /**
   * Get account info with automatic retry on rate limit
   */
  async getAccountInfoWithRetry(
    publicKey: PublicKey,
    maxRetries: number = 3,
  ): Promise<AccountInfo<Buffer> | null> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await this.getAccountInfo(publicKey);
      } catch (error: any) {
        const isRateLimit =
          error?.message?.includes('429') || error?.message?.includes('rate limit');
        const isLastAttempt = i === maxRetries - 1;

        if (isRateLimit && !isLastAttempt) {
          const delay = Math.min(5000 * Math.pow(2, i), 30000);
          console.debug(
            `[SolanaConnection] Rate limited on getAccountInfo, retry ${i + 1}/${maxRetries} after ${delay}ms`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        if (isLastAttempt) {
          throw error;
        }
      }
    }

    return null;
  }

  /**
   * Close all connections properly
   */
  async close(): Promise<void> {
    // Clear connection references
    if (this.wsConnection) {
      this.wsConnection = null;
      this.wsConnected = false;
    }

    this.connection = null as any;

    console.log('[SolanaConnection] Connections closed');
  }

  /**
   * Get connection health status
   */
  async getHealthStatus(): Promise<{
    rpc: boolean;
    ws: boolean;
    rpcUrl: string;
    wsUrl?: string;
  }> {
    const status = {
      rpc: false,
      ws: false,
      rpcUrl: this.config.rpcUrl,
      wsUrl: this.config.wsUrl,
    };

    try {
      await this.connection.getVersion();
      status.rpc = true;
    } catch {
      status.rpc = false;
    }

    if (this.wsConnection) {
      try {
        await this.wsConnection.getVersion();
        status.ws = true;
        this.wsConnected = true;
      } catch {
        status.ws = false;
        this.wsConnected = false;
      }
    }

    return status;
  }

  /**
   * Reconnect to WebSocket
   */
  async reconnectWebSocket(): Promise<void> {
    this.wsConnection = null;
    this.wsConnected = false;
    await this.connectWebSocket();
  }
}

/**
 * Default RPC endpoints
 */
export const DEFAULT_RPC_ENDPOINTS = {
  mainnet: 'https://api.mainnet-beta.solana.com',
  devnet: 'https://api.devnet.solana.com',
  testnet: 'https://api.testnet.solana.com',
};

/**
 * Create a connection manager from environment variables
 */
export function createConnectionFromEnv(
  env: Record<string, string | undefined> = process.env,
): SolanaConnectionManager {
  const rpcUrl = env.SOLANA_RPC_URL || DEFAULT_RPC_ENDPOINTS.mainnet;
  const wsUrl = env.SOLANA_WS_URL;
  const commitment = (env.SOLANA_COMMITMENT || 'confirmed') as CommitmentLevel;

  return new SolanaConnectionManager({
    rpcUrl,
    wsUrl,
    commitment,
  });
}

/**
 * Singleton connection manager instance (lazy initialized)
 */
let globalConnection: SolanaConnectionManager | null = null;

export function getGlobalConnection(): SolanaConnectionManager {
  if (!globalConnection) {
    globalConnection = createConnectionFromEnv();
  }
  return globalConnection;
}
