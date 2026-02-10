import { Connection, ConnectionConfig as SolanaConnectionConfig, PublicKey } from '@solana/web3.js';
import { EventEmitter } from 'eventemitter3';
import type {
  ConnectionConfig,
  RpcPoolEntry,
  WebSocketReconnectConfig,
} from './types.js';
import { ConnectionState } from './types.js';

/**
 * Default WebSocket reconnection configuration
 */
const DEFAULT_WS_RECONNECT_CONFIG: Required<WebSocketReconnectConfig> = {
  maxAttempts: 10,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  jitterMs: 1000,
};

/**
 * Solana Connection Manager
 *
 * Manages Connection instances with RPC pooling, WebSocket reconnection,
 * and connection state monitoring.
 */
export class SolanaConnectionManager extends EventEmitter {
  private httpConnection: Connection;
  private wsConnection: Connection | null = null;
  private config: ConnectionConfig;
  private rpcPool: RpcPoolEntry[] = [];
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private subscriptions: Map<number, () => void> = new Map();
  private nextSubscriptionId = 0;

  /**
   * Create a new SolanaConnectionManager
   */
  constructor(config: ConnectionConfig) {
    super();
    this.config = config;
    this.httpConnection = this.createConnection(config.httpUrl);

    if (config.enablePooling && config.rpcPoolUrls && config.rpcPoolUrls.length > 0) {
      this.initializeRpcPool();
    }

    if (config.wsReconnect !== false) {
      this.initializeWebSocket();
    }
  }

  /**
   * Create a Connection instance
   */
  private createConnection(endpoint: string): Connection {
    const solanaConfig: SolanaConnectionConfig = {
      commitment: this.config.commitment || 'confirmed',
      wsEndpoint: undefined, // Will be set separately for WS
    };
    return new Connection(endpoint, solanaConfig);
  }

  /**
   * Initialize RPC pool for failover
   */
  private initializeRpcPool(): void {
    const urls = [this.config.httpUrl, ...(this.config.rpcPoolUrls || [])];

    this.rpcPool = urls.map(url => ({
      url,
      connection: this.createConnection(url),
      healthy: true,
      failureCount: 0,
    }));

    this.startHealthChecks();
  }

  /**
   * Start health checks for RPC pool
   */
  private startHealthChecks(): void {
    const checkInterval = 30000; // 30 seconds

    setInterval(async () => {
      for (const entry of this.rpcPool) {
        try {
          const start = Date.now();
          await entry.connection.getLatestBlockhash();
          entry.latency = Date.now() - start;
          entry.healthy = true;
          entry.failureCount = 0;
          entry.lastCheck = new Date();
        } catch (error) {
          entry.failureCount++;
          entry.healthy = entry.failureCount < 3;
          entry.lastCheck = new Date();
        }
      }
    }, checkInterval);
  }

  /**
   * Get the best available connection from the pool
   */
  private getBestConnection(): Connection {
    if (!this.config.enablePooling || this.rpcPool.length === 0) {
      return this.httpConnection;
    }

    // Filter healthy entries and sort by latency
    const healthyEntries = this.rpcPool
      .filter(entry => entry.healthy)
      .sort((a, b) => (a.latency || Infinity) - (b.latency || Infinity));

    const bestEntry = healthyEntries[0];
    if (bestEntry) {
      return bestEntry.connection;
    }

    // Fallback to primary if no healthy entries
    return this.httpConnection;
  }

  /**
   * Initialize WebSocket connection with reconnection logic
   */
  private initializeWebSocket(): void {
    const wsUrl = this.config.wsUrl || this.deriveWsUrl(this.config.httpUrl);

    try {
      this.wsConnection = new Connection(wsUrl, {
        commitment: this.config.commitment || 'confirmed',
        wsEndpoint: wsUrl,
      });

      this.setState(ConnectionState.CONNECTING);

      // Set up WebSocket event handlers
      this.setupWebSocketHandlers();

    } catch (error) {
      this.emit('wsError', error);
      this.handleReconnect();
    }
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    if (!this.wsConnection) return;

    // Monitor connection state through a sentinel
    const subscriptionId = this.wsConnection.onAccountChange(
      new PublicKey('SysvarC1ock11111111111111111111111111111111'),
      () => {
        // First successful callback means connection is established
        if (this.state === ConnectionState.CONNECTING || this.state === ConnectionState.RECONNECTING) {
          this.setState(ConnectionState.CONNECTED);
          this.reconnectAttempts = 0;
          this.emit('wsConnected');
        }
      },
      'confirmed'
    );

    // Store subscription ID for cleanup
    this.registerSubscription(() => {
      try {
        this.wsConnection?.removeAccountChangeListener(subscriptionId);
      } catch {
        // Ignore cleanup errors
      }
    });

    // Set up reconnection on WebSocket errors
    const wsEndpoint = (this.wsConnection as any)._rpcEndpoint;
    if (wsEndpoint && typeof wsEndpoint === 'string' && wsEndpoint.startsWith('ws')) {
      // Note: @solana/web3.js doesn't expose WS error events directly
      // We'll handle reconnection through health checks
    }
  }

  /**
   * Handle WebSocket reconnection with exponential backoff
   */
  private handleReconnect(): void {
    const reconnectConfig = this.config.wsReconnect === true
      ? DEFAULT_WS_RECONNECT_CONFIG
      : { ...DEFAULT_WS_RECONNECT_CONFIG, ...this.config.wsReconnect };

    if (this.reconnectAttempts >= reconnectConfig.maxAttempts) {
      this.setState(ConnectionState.FAILED);
      this.emit('wsReconnectFailed', this.reconnectAttempts);
      return;
    }

    this.reconnectAttempts++;
    this.setState(ConnectionState.RECONNECTING);

    // Calculate delay with exponential backoff and jitter
    const exponentialDelay = Math.min(
      reconnectConfig.baseDelayMs * Math.pow(2, this.reconnectAttempts - 1),
      reconnectConfig.maxDelayMs
    );
    const jitter = Math.random() * reconnectConfig.jitterMs;
    const delay = exponentialDelay + jitter;

    this.emit('wsReconnecting', {
      attempt: this.reconnectAttempts,
      maxAttempts: reconnectConfig.maxAttempts,
      delay,
    });

    this.reconnectTimer = setTimeout(() => {
      this.initializeWebSocket();
    }, delay);
  }

  /**
   * Restore subscriptions after reconnection
   */
  private restoreSubscriptions(): void {
    // Subscriptions will need to be re-established by the caller
    // This is a placeholder for future implementation
    this.emit('subscriptionsRestored');
  }

  /**
   * Derive WebSocket URL from HTTP URL
   */
  private deriveWsUrl(httpUrl: string): string {
    return httpUrl.replace('https://', 'wss://').replace('http://', 'ws://');
  }

  /**
   * Set connection state and emit event
   */
  private setState(newState: ConnectionState): void {
    const oldState = this.state;
    this.state = newState;
    this.emit('stateChange', { oldState, newState });
  }

  /**
   * Get the current HTTP connection (with pooling support)
   */
  getConnection(): Connection {
    return this.getBestConnection();
  }

  /**
   * Get the WebSocket connection
   */
  getWebSocketConnection(): Connection | null {
    return this.wsConnection;
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get RPC pool status
   */
  getPoolStatus(): RpcPoolEntry[] {
    return [...this.rpcPool];
  }

  /**
   * Register a subscription for cleanup
   */
  registerSubscription(unsubscribe: () => void): number {
    const id = this.nextSubscriptionId++;
    this.subscriptions.set(id, unsubscribe);
    return id;
  }

  /**
   * Unregister and cleanup a subscription
   */
  unregisterSubscription(id: number): void {
    const unsubscribe = this.subscriptions.get(id);
    if (unsubscribe) {
      unsubscribe();
      this.subscriptions.delete(id);
    }
  }

  /**
   * Disconnect and cleanup all resources
   */
  async disconnect(): Promise<void> {
    // Clear reconnection timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Unregister all subscriptions
    for (const [id, unsubscribe] of this.subscriptions.entries()) {
      unsubscribe();
    }
    this.subscriptions.clear();

    // Close WebSocket connection
    if (this.wsConnection) {
      try {
        // @solana/web3.js doesn't have an explicit close method for WebSocket
        // The connection will be garbage collected
      } catch (error) {
        // Ignore errors during disconnect
      }
      this.wsConnection = null;
    }

    this.setState(ConnectionState.DISCONNECTED);
    this.emit('disconnected');
  }

  /**
   * Force a reconnection
   */
  async reconnect(): Promise<void> {
    await this.disconnect();
    this.reconnectAttempts = 0;
    this.initializeWebSocket();
  }
}

/**
 * Create a new SolanaConnectionManager instance
 */
export function createConnectionManager(config: ConnectionConfig): SolanaConnectionManager {
  return new SolanaConnectionManager(config);
}
