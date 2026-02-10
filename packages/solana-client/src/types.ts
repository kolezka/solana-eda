import type { Commitment, Connection, PublicKey } from '@solana/web3.js';

/**
 * Connection configuration options
 */
export interface ConnectionConfig {
  /** HTTP RPC endpoint URL */
  httpUrl: string;
  /** WebSocket endpoint URL (optional, will be derived from httpUrl if not provided) */
  wsUrl?: string;
  /** Commitment level */
  commitment?: Commitment;
  /** Enable RPC pooling for failover */
  enablePooling?: boolean;
  /** RPC pool URLs (if pooling is enabled) */
  rpcPoolUrls?: string[];
  /** WebSocket reconnection configuration */
  wsReconnect?: boolean | WebSocketReconnectConfig;
}

/**
 * WebSocket reconnection configuration
 */
export interface WebSocketReconnectConfig {
  /** Maximum number of reconnection attempts */
  maxAttempts?: number;
  /** Base delay in milliseconds for exponential backoff */
  baseDelayMs?: number;
  /** Maximum delay in milliseconds */
  maxDelayMs?: number;
  /** Jitter to add to delay in milliseconds */
  jitterMs?: number;
}

/**
 * Connection state enum
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed',
}

/**
 * RPC pool entry
 */
export interface RpcPoolEntry {
  url: string;
  connection: Connection;
  healthy: boolean;
  lastCheck?: Date;
  latency?: number;
  failureCount: number;
}

/**
 * OpenBook market state (simplified from MARKET_STATE_LAYOUT_V3)
 */
export interface MarketState {
  /** Market account address */
  address: PublicKey;
  /** Base token mint */
  baseMint: PublicKey;
  /** Quote token mint */
  quoteMint: PublicKey;
  /** Bids address */
  bids: PublicKey;
  /** Asks address */
  asks: PublicKey;
  /** Event queue address */
  eventQueue: PublicKey;
  /** Coin vault address */
  baseVault: PublicKey;
  /** PC vault address */
  quoteVault: PublicKey;
  /** Base lot size */
  baseLotSize: bigint;
  /** Quote lot size */
  quoteLotSize: bigint;
  /** Fee rate BPS */
  feeRateBps: number;
  /** Market flags (default: 0) */
  flags?: number;
  /** Exists flag (default: true) */
  exists?: boolean;
}

/**
 * Market discovery filters
 */
export interface MarketFilters {
  /** Quote mint to filter by (e.g., USDT, USDC) */
  quoteMint?: string | PublicKey;
  /** Base mints to filter by (optional) */
  baseMints?: Array<string | PublicKey>;
  /** Commitment level for subscriptions */
  commitment?: Commitment;
}

/**
 * Market discovery callback
 */
export type MarketDiscoveryCallback = (market: MarketState) => void | Promise<void>;

/**
 * Market discovery error callback
 */
export type MarketErrorCallback = (error: Error) => void | Promise<void>;

/**
 * OpenBook client configuration
 */
export interface OpenBookClientConfig {
  /** Solana connection instance */
  connection: Connection;
  /** Market discovery filters */
  filters?: MarketFilters;
  /** Callback when a new market is discovered */
  onMarketDiscovered: MarketDiscoveryCallback;
  /** Callback when an error occurs */
  onError?: MarketErrorCallback;
  /** OpenBook program ID (default: MAINNET) */
  programId?: PublicKey;
}

/**
 * Account change callback result
 */
export interface AccountChangeResult {
  account_id: string;
  account_info: {
    data: Buffer;
    owner: PublicKey;
    executable: boolean;
    lamports: number;
  };
  context: {
    slot: number;
  };
}
