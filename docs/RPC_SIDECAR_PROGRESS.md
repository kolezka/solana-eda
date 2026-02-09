# RPC Sidecar Implementation - Progress Report

## Task #34: Implement RPC Sidecar for shared connections

### Status: IN PROGRESS

### Completed Work

#### Phase 1: RPC Sidecar Service ✅
Created `workers/rpc-sidecar/` with:
- `package.json` - Dependencies (ws, @solana/web3.js)
- `tsconfig.json` - TypeScript configuration
- `src/index.ts` - Full sidecar implementation:
  - IPC server using Unix domain socket (`/tmp/solana-rpc.sock`)
  - WebSocket server for subscriptions (port 3002)
  - Single `SolanaConnectionManager` with pooling enabled
  - Request handling for all common RPC methods
  - Subscription forwarding for WebSocket events
  - Health monitoring and metrics
  - Graceful shutdown handling

**Key Features:**
- Single connection to RPC provider (solves rate limiting issue)
- Fast IPC communication for HTTP RPC calls
- WebSocket event broadcasting to multiple subscribers
- Connection pooling with health checking
- Automatic reconnection on failure

#### Phase 2: Sidecar Client Library ✅
Created `packages/solana-client/src/sidecar-client.ts`:
- `SidecarConnection` class
- Drop-in replacement API for `SolanaConnectionManager`
- IPC client for HTTP RPC calls
- WebSocket client for subscriptions
- Connection health monitoring
- Automatic reconnection

**API Methods:**
- `connect()` - Connect to sidecar
- `getAccountInfo()`
- `getTransaction()`
- `getMultipleAccounts()`
- `getLatestBlockhash()`
- `getBalance()`
- `sendRawTransaction()`
- `confirmTransaction()`
- `getTokenAccountBalance()`
- `onLogs()` - Subscribe to logs
- `onAccountChange()` - Subscribe to account changes
- `getHealthStatus()` - Get sidecar health
- `ping()` - Ping sidecar
- `close()` - Close connection

#### Phase 3: Package Exports ✅
Updated `packages/solana-client/src/index.ts`:
- Added export for `sidecar-client`
- Workers can now import `SidecarConnection`

#### Phase 4: Burn Detector Worker Update ✅
Updated `workers/burn-detector/src/index.ts`:
- Added `SidecarConnection` import
- Added `USE_SIDECAR` environment variable check
- Conditional connection creation based on `USE_SIDECAR` flag
- Updated `start()` method to connect to sidecar
- Updated `stop()` method to close sidecar connection
- Updated `subscribeToTransactions()` to handle sidecar

**Pattern Applied:**
```typescript
if (this.useSidecar) {
  this.connection = new SidecarConnection();
  console.log('[BurnDetector] Using RPC Sidecar for connection');
} else {
  this.connection = new SolanaConnectionManager({ rpcUrl, wsUrl });
  console.log('[BurnDetector] Using direct Solana connection');
}
```

#### Phase 5: Docker Integration ✅
Updated `docker-compose.yml`:
- Added `rpc-sidecar` service
- Configured environment variables
- Added volume mount for IPC socket (`/tmp:/tmp`)
- Added health check dependency for workers
- Updated `burn-detector` to depend on `rpc-sidecar`
- Added sidecar environment variables to `burn-detector`

### Remaining Work

#### Phase 4 Continued: Update Remaining Workers (~1 hour)
- [ ] Update `liquidity-monitor` worker
- [ ] Update `price-aggregator` worker
- [ ] Update `trading-bot` worker
- [ ] Update `market-detector` worker

**Pattern to apply:**
1. Add `SidecarConnection` import
2. Add `useSidecar` flag and `USE_SIDECAR` env check
3. Conditional connection creation
4. Update `start()` to connect to sidecar
5. Update `stop()` to close sidecar
6. Update WebSocket subscriptions to handle sidecar

#### Phase 6: Docker Integration Continued (~30 minutes)
- Update remaining workers in docker-compose.yml:
  - `liquidity-monitor`
  - `price-aggregator`
  - `trading-bot`
  - `market-detector`
- Add sidecar environment variables
- Add sidecar dependency
- Add volume mount for IPC socket

#### Phase 7: Testing (~2 hours)
- [ ] Test sidecar startup
- [ ] Test worker connection to sidecar
- [ ] Test IPC RPC calls
- [ ] Test WebSocket subscriptions
- [ ] Test event forwarding
- [ ] Test sidecar restart scenario
- [ ] Test high load scenarios
- [ ] Verify single connection to RPC provider

#### Phase 8: Documentation (~30 minutes)
- [ ] Update `.env.example` with sidecar variables
- [ ] Update `workers/README.md` with sidecar info
- [ ] Update main `README.md` with architecture diagram

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   Docker Host                            │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │           RPC Sidecar Container                   │  │
│  │                                                    │  │
│  │  ┌──────────────────────────────────────────┐   │  │
│  │  │   SolanaConnectionManager                 │   │  │
│  │  │   (Single connection to RPC provider)     │   │  │
│  │  └──────────────────────────────────────────┘   │  │
│  │                                                    │  │
│  │  IPC Socket (/tmp/solana-rpc.sock)              │  │
│  │  WebSocket Server (port 3002)                   │  │
│  └──────────────────────────────────────────────────┘  │
│                          ▲           ▲                  │
│         IPC               │           │  WebSocket       │
│                          │           │                  │
│  ┌───────────────────────┴───┐  ┌────┴───────────┐      │
│  │   Burn Detector          │  │  Other Workers  │      │
│  │   (SidecarConnection)    │  │                 │      │
│  └───────────────────────────┘  └────────────────┘      │
│                                                          │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │  RPC Provider    │
                    │ (sees 1 conn!)   │
                    └─────────────────┘
```

### Environment Variables

**Sidecar Service:**
- `SOLANA_RPC_URL` - Primary RPC endpoint
- `SOLANA_WS_URL` - WebSocket endpoint
- `SOLANA_RPC_URLS` - Additional endpoints (for pooling)
- `RPC_SIDECAR_SOCKET` - Unix socket path (default: `/tmp/solana-rpc.sock`)
- `RPC_SIDECAR_WS_PORT` - WebSocket port (default: `3002`)

**Workers:**
- `USE_SIDECAR` - Enable sidecar connection (default: `true`)
- `RPC_SIDECAR_SOCKET` - Unix socket path (must match sidecar)
- `RPC_SIDECAR_WS_URL` - WebSocket URL (e.g., `ws://rpc-sidecar:3002`)

### Next Steps

1. Complete remaining worker updates (4 workers)
2. Update docker-compose.yml for remaining workers
3. Build and test the sidecar
4. Test workers with sidecar enabled
5. Document the setup

### Files Created/Modified

**Created:**
- `workers/rpc-sidecar/package.json`
- `workers/rpc-sidecar/tsconfig.json`
- `workers/rpc-sidecar/src/index.ts` (600+ lines)
- `packages/solana-client/src/sidecar-client.ts` (400+ lines)
- `docs/RPC_SIDECAR_SOLUTION.md` (implementation plan)

**Modified:**
- `packages/solana-client/src/index.ts` (added sidecar export)
- `workers/burn-detector/src/index.ts` (added sidecar support)
- `docker-compose.yml` (added rpc-sidecar service and burn-detector config)

### Success Criteria (Not Yet Validated)

- [ ] RPC provider sees 1 connection (from sidecar)
- [ ] All workers connect to sidecar successfully
- [ ] IPC/WebSocket communication works reliably
- [ ] WebSocket subscriptions forward events correctly
- [ ] Sidecar restart doesn't break workers
- [ ] Latency overhead < 10ms compared to direct connections
