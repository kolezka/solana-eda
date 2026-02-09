import { Connection, PublicKey } from '@solana/web3.js';
import type { AccountInfo, Context } from '@solana/web3.js';
import { RateLimiter, RPC_RATE_LIMITS } from './rate-limiter';
import { RpcConnectionPool, createRpcPoolFromEnv, type ConnectionType } from './rpc-pool';
import { EventEmitter } from 'events';

export type CommitmentLevel = 'processed' | 'confirmed' | 'finalized';

export interface ConnectionConfig {
  rpcUrl: string;
  wsUrl?: string;
  commitment?: CommitmentLevel;
  httpHeaders?: Record<string, string>;
  disableRetryOnRateLimit?: boolean;
  usePool?: boolean; // Enable RPC connection pooling
  wsReconnect?: boolean; // Enable WebSocket auto-reconnect
  maxReconnectAttempts?: number; // Max reconnection attempts (default: 10)
}

export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
  ERROR = 'ERROR'
}

export interface WebSocketReconnectConfig {
  enabled: boolean;
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterMs: number;
}

/**
 * Manages Solana RPC and WebSocket connections with proper lifecycle
 * Supports optional connection pooling for high availability and load balancing
 */
export class SolanaConnectionManager extends EventEmitter {
  private connection: Connection;
  private wsConnection: Connection | null = null;

  private rateLimiter: RateLimiter;
  private wsConnected: boolean = false;
  private autoReconnect: boolean = false;

  // WebSocket reconnection state
  private wsReconnectConfig: WebSocketReconnectConfig = {
    enabled: false,
    maxAttempts: 10,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    jitterMs: 1000,
  };
  private reconnectAttempts: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private wsConnectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private subscriptions: Map<string, { filter: any; callback: any; commitment?: CommitmentLevel }> = new Map();

  // Optional connection pooling support
  private pool: RpcConnectionPool | null = null;
  private usePool: boolean = false;

  constructor(private config: ConnectionConfig) {
    super(); // Call EventEmitter constructor

    // Check if pooling is enabled
    this.usePool = config.usePool || !!process.env.SOLANA_RPC_URLS?.includes(',');

    // Create rate limiter (used when pool is disabled)
    const rateLimitConfig = this.getRateLimitConfig(this.config.rpcUrl);
    this.rateLimiter = new RateLimiter(rateLimitConfig);

    // Initialize connection pool if enabled
    if (this.usePool) {
      try {
        this.pool = createRpcPoolFromEnv();
        console.log('[SolanaConnectionManager] RPC connection pooling enabled');
        // Get initial connection from pool
        this.connection = this.pool.getConnection('query');
      } catch (error) {
        console.warn('[SolanaConnectionManager] Failed to initialize pool, falling back to single connection:', error);
        this.usePool = false;
        this.pool = null;
        this.connection = new Connection(this.config.rpcUrl, {
          commitment: 'confirmed',
          disableRetryOnRateLimit: this.config.disableRetryOnRateLimit,
        });
      }
    } else {
      this.connection = new Connection(this.config.rpcUrl, {
        commitment: 'confirmed',
        disableRetryOnRateLimit: this.config.disableRetryOnRateLimit,
      });
    }

    // WebSocket connections are handled separately (pool for WS uses different type)
    if (this.config.wsUrl) {
      // Initialize WebSocket reconnection config
      this.wsReconnectConfig = {
        enabled: this.config.wsReconnect ?? true,
        maxAttempts: this.config.maxReconnectAttempts ?? 10,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
        jitterMs: 1000,
      };

      if (this.usePool && this.pool) {
        this.wsConnection = this.pool.getConnection('websocket');
      } else {
        this.wsConnection = new Connection(this.config.wsUrl, {
          commitment: 'confirmed',
          wsEndpoint: this.config.wsUrl,
          disableRetryOnRateLimit: this.config.disableRetryOnRateLimit,
        });
      }

      // Set up WebSocket reconnection listeners
      if (this.wsReconnectConfig.enabled && this.wsConnection) {
        this.setupWebSocketReconnection();
      }
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
   * When pooling is enabled, returns a connection from the query pool
   */
  getConnection(): Connection {
    if (this.usePool && this.pool) {
      return this.pool.getConnection('query');
    }
    return this.connection;
  }

  /**
   * Get a connection for submit operations (transactions)
   * When pooling is enabled, uses the dedicated submit pool
   */
  getSubmitConnection(): Connection {
    if (this.usePool && this.pool) {
      return this.pool.getConnection('submit');
    }
    return this.connection;
  }

  /**
   * Get a connection for query operations (reads)
   * When pooling is enabled, uses the query pool
   */
  getQueryConnection(): Connection {
    return this.getConnection();
  }

  /**
   * Check if pooling is enabled
   */
  isPoolingEnabled(): boolean {
    return this.usePool && this.pool !== null;
  }

  /**
   * Get pool statistics if pooling is enabled
   */
  getPoolStats(): Map<ConnectionType, any> | null {
    if (this.usePool && this.pool) {
      return this.pool.getPoolStats();
    }
    return null;
  }

  /**
   * Execute a function with the connection pool (if enabled)
   * Provides automatic failover and retry
   */
  async executeWithPool<T>(
    type: ConnectionType,
    fn: (connection: Connection) => Promise<T>,
    options?: { maxRetries?: number }
  ): Promise<T> {
    if (this.usePool && this.pool) {
      return await this.pool.executeWithRetry(type, fn, options);
    }
    // Fallback to direct execution
    return await fn(this.getConnection());
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
   * Subscriptions are automatically restored after reconnection
   */
  onAccountChange(
    publicKey: PublicKey,
    callback: (accountInfo: AccountInfo<Buffer> | null, context: Context) => void,
    commitment?: CommitmentLevel,
  ): number {
    const conn = this.getWsConnectionOrThrow();
    const subscriptionId = conn.onAccountChange(publicKey, callback, commitment);

    // Track subscription for restoration after reconnection
    this.subscriptions.set(subscriptionId.toString(), {
      filter: publicKey, // Using publicKey as filter identifier
      callback,
      commitment,
    });

    return subscriptionId;
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
   * Subscriptions are automatically restored after reconnection
   */
  onLogs(
    filter: any,
    callback: (logs: any, context: any) => void,
    commitment?: CommitmentLevel,
  ): number {
    const conn = this.getWsConnectionOrThrow();
    const subscriptionId = conn.onLogs(filter, callback, commitment);

    // Track subscription for restoration after reconnection
    this.subscriptions.set(subscriptionId.toString(), {
      filter,
      callback,
      commitment,
    });

    return subscriptionId;
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
   * Uses pool if enabled for automatic failover
   */
  async getAccountInfo(publicKey: PublicKey): Promise<AccountInfo<Buffer> | null> {
    if (this.usePool && this.pool) {
      return await this.pool.executeWithRetry('query', (conn) =>
        conn.getAccountInfo(publicKey)
      );
    }
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
   * Uses submit pool when enabled for critical transaction path
   */
  async sendRawTransaction(
    transaction: Buffer,
    options?: { skipPreflight?: boolean; maxRetries?: number },
  ): Promise<string> {
    if (this.usePool && this.pool) {
      return await this.pool.executeWithRetry('submit', (conn) =>
        conn.sendRawTransaction(transaction, options)
      );
    }
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
    // Close connection pool if enabled
    if (this.pool) {
      await this.pool.close();
      this.pool = null;
    }

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
   * Includes pool statistics if pooling is enabled
   */
  async getHealthStatus(): Promise<{
    rpc: boolean;
    ws: boolean;
    rpcUrl: string;
    wsUrl?: string;
    poolingEnabled: boolean;
    poolStats?: Map<ConnectionType, any>;
  }> {
    const status: {
      rpc: boolean;
      ws: boolean;
      rpcUrl: string;
      wsUrl?: string;
      poolingEnabled: boolean;
      poolStats?: Map<ConnectionType, any>;
    } = {
      rpc: false,
      ws: false,
      rpcUrl: this.config.rpcUrl,
      wsUrl: this.config.wsUrl,
      poolingEnabled: this.usePool && this.pool !== null,
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

    // Add pool stats if pooling is enabled
    if (status.poolingEnabled && this.pool) {
      status.poolStats = this.pool.getPoolStats();
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

  /**
   * Calculate reconnection delay with exponential backoff and jitter
   */
  private calculateReconnectDelay(attempt: number): number {
    const baseDelay = Math.min(
      this.wsReconnectConfig.baseDelayMs * Math.pow(2, attempt),
      this.wsReconnectConfig.maxDelayMs
    );
    const jitter = Math.random() * this.wsReconnectConfig.jitterMs;
    return Math.floor(baseDelay + jitter);
  }

  /**
   * Setup WebSocket reconnection listeners
   * Note: The Solana Connection class doesn't expose standard WebSocket events.
   * This method sets up periodic health checks to detect disconnections.
   */
  private setupWebSocketReconnection(): void {
    if (!this.wsConnection) return;

    // Set up a periodic health check since Connection doesn't expose WebSocket events
    const healthCheckInterval = 30000; // 30 seconds

    const checkHealth = async () => {
      if (!this.wsConnection || !this.wsReconnectConfig.enabled || !this.autoReconnect) {
        return;
      }

      try {
        // Try to get version as a health check
        await this.wsConnection.getVersion();

        // If we were previously disconnected and now we're connected
        if (!this.wsConnected) {
          this.wsConnected = true;
          this.wsConnectionState = ConnectionState.CONNECTED;

          if (this.reconnectAttempts > 0) {
            console.log(`[SolanaConnection] WebSocket reconnected after ${this.reconnectAttempts} attempts`);
            this.emit('wsReconnected', { attempts: this.reconnectAttempts });
          }

          this.reconnectAttempts = 0;
          this.emit('wsConnected');
        }
      } catch (error) {
        // WebSocket is disconnected
        if (this.wsConnected) {
          console.warn('[SolanaConnection] WebSocket connection lost');
          this.wsConnected = false;
          this.wsConnectionState = ConnectionState.DISCONNECTED;
          this.emit('wsDisconnected');

          if (this.wsReconnectConfig.enabled && this.autoReconnect) {
            this.scheduleReconnect();
          }
        }
      }
    };

    // Start health check interval
    const healthTimer = setInterval(checkHealth, healthCheckInterval);

    // Store timer for cleanup (we'll add a Map to track these if needed)
    // For now, just run initial check after a short delay
    setTimeout(() => {
      checkHealth();
      // Clear the interval after first check - rely on automatic reconnection
      clearInterval(healthTimer);
    }, 1000);
  }

  /**
   * Schedule a reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return; // Already scheduled
    }

    if (this.reconnectAttempts >= this.wsReconnectConfig.maxAttempts) {
      console.error('[SolanaConnection] Max reconnection attempts reached');
      this.wsConnectionState = ConnectionState.ERROR;
      this.emit('wsReconnectFailed', { attempts: this.reconnectAttempts });
      return;
    }

    const delay = this.calculateReconnectDelay(this.reconnectAttempts);
    this.reconnectAttempts++;

    console.log(
      `[SolanaConnection] Scheduling reconnection attempt ${this.reconnectAttempts}/${this.wsReconnectConfig.maxAttempts} in ${delay}ms`
    );
    this.emit('wsReconnecting', { attempt: this.reconnectAttempts, delay });

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      await this.performReconnect();
    }, delay);
  }

  /**
   * Perform the actual reconnection
   */
  private async performReconnect(): Promise<void> {
    this.wsConnectionState = ConnectionState.RECONNECTING;

    try {
      const wsUrl = this.getWsUrl();
      if (!wsUrl) {
        throw new Error('No WebSocket URL available');
      }

      // Create new WebSocket connection
      this.wsConnection = new Connection(wsUrl, {
        commitment: 'confirmed',
        wsEndpoint: wsUrl,
        disableRetryOnRateLimit: this.config.disableRetryOnRateLimit,
      });

      // Verify connection
      await this.wsConnection.getVersion();
      this.wsConnected = true;
      this.wsConnectionState = ConnectionState.CONNECTED;

      console.log(`[SolanaConnection] WebSocket reconnected successfully`);

      // Re-register all subscriptions
      await this.restoreSubscriptions();

      // Set up reconnection listeners again
      this.setupWebSocketReconnection();
    } catch (error) {
      console.error(`[SolanaConnection] Reconnection attempt ${this.reconnectAttempts} failed:`, error);
      this.wsConnected = false;
      this.wsConnectionState = ConnectionState.ERROR;

      // Schedule next reconnection attempt
      if (this.wsReconnectConfig.enabled && this.autoReconnect) {
        this.scheduleReconnect();
      }
    }
  }

  /**
   * Restore all subscriptions after reconnection
   */
  private async restoreSubscriptions(): Promise<void> {
    console.log(`[SolanaConnection] Restoring ${this.subscriptions.size} subscriptions`);

    const entries = Array.from(this.subscriptions.entries());

    for (const [subscriptionId, subscription] of entries) {
      try {
        const newSubId = this.wsConnection!.onLogs(
          subscription.filter,
          subscription.callback,
          subscription.commitment
        );

        // Update the subscription ID mapping
        this.subscriptions.set(newSubId.toString(), subscription);
        this.subscriptions.delete(subscriptionId);

        console.debug(`[SolanaConnection] Restored subscription: ${subscriptionId} -> ${newSubId}`);
      } catch (error) {
        console.error(`[SolanaConnection] Failed to restore subscription ${subscriptionId}:`, error);
      }
    }

    console.log(`[SolanaConnection] Subscription restoration complete`);
  }

  /**
   * Get the current WebSocket connection state
   */
  getWebSocketState(): ConnectionState {
    return this.wsConnectionState;
  }

  /**
   * Get the number of reconnection attempts
   */
  getReconnectAttempts(): number {
    return this.reconnectAttempts;
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
