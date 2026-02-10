// Connection manager
export {
  SolanaConnectionManager,
  createConnectionManager,
} from './connection.js';

// OpenBook client
export {
  OpenBookClient,
  createOpenBookClient,
  getDefaultQuoteMints,
  getOpenBookProgramIds,
} from './openbook-client.js';

// Types
export type {
  ConnectionConfig,
  WebSocketReconnectConfig,
  ConnectionState,
  RpcPoolEntry,
  MarketState,
  MarketFilters,
  MarketDiscoveryCallback,
  MarketErrorCallback,
  OpenBookClientConfig,
  AccountChangeResult,
} from './types.js';

export { ConnectionState as ConnectionStateEnum } from './types.js';
