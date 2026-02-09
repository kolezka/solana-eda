# RPC Shared Connection Fix - Corrected Plan

## The Real Problem

**Current Issue:**
- All 5 workers (`burn-detector`, `liquidity-monitor`, `price-aggregator`, `trading-bot`, `market-detector`) connect to the **same RPC URL**
- Each worker creates its own `SolanaConnectionManager` instance
- Each instance creates its own HTTP/WebSocket connections
- RPC provider sees **5 separate connections** from the same host
- Provider applies rate limits across these connections collectively

**Example Scenario:**
```
RPC Provider Limit: 100 requests/second per connection

Current State:
┌─────────────────┐     ┌─────────────────┐
│  burn-detector  │────▶│                 │
├─────────────────┤     │                 │
│ liquidity-monitor│────▶│   Same RPC URL  │
├─────────────────┤     │                 │
│ price-aggregator│────▶│  (rate limited) │
├─────────────────┤     │                 │
│  trading-bot    │────▶│                 │
├─────────────────┤     │                 │
│ market-detector │────▶│                 │
└─────────────────┘     └─────────────────┘
    5 connections           5 × 100 = 500 rps potential
                           Provider sees this and rate limits

Desired State:
┌─────────────────┐     ┌─────────────────┐
│  burn-detector  │     │                 │
├─────────────────┤     │                 │
│ liquidity-monitor│    │  Shared Pool    │
├─────────────────┤  ┌─▶│  (1 connection) │
│ price-aggregator│  │  │                 │
├─────────────────┤  │  │  to RPC URL     │
│  trading-bot    │  │  │                 │
├─────────────────┤  │  │ (100 rps limit) │
│ market-detector │  ──▶│                 │
└─────────────────┘     └─────────────────┘
    Shared                  Managed request distribution
```

## Root Cause

**Worker Code Pattern (all 5 workers):**
```typescript
// Each worker creates its own connection manager
constructor() {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  this.connection = new SolanaConnectionManager({ rpcUrl, wsUrl });
}
```

**Result:** 5 separate `SolanaConnectionManager` instances = 5 separate connection pools to the same RPC endpoint.

## Solution Options

### Option 1: Singleton Connection Manager (Recommended)

**Create a shared connection module that all workers import:**

```typescript
// packages/solana-client/src/shared-connection.ts
let sharedConnection: SolanaConnectionManager | null = null;

export function getSharedConnection(): SolanaConnectionManager {
  if (!sharedConnection) {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const wsUrl = process.env.SOLANA_WS_URL;

    sharedConnection = new SolanaConnectionManager({
      rpcUrl,
      wsUrl,
      usePool: true, // Enable pooling
    });

    console.log('[SharedConnection] Created shared connection manager');
  }

  return sharedConnection;
}

export async function closeSharedConnection(): Promise<void> {
  if (sharedConnection) {
    await sharedConnection.close();
    sharedConnection = null;
  }
}
```

**Worker changes:**
```typescript
// OLD:
import { SolanaConnectionManager } from '@solana-eda/solana-client';
// ...
this.connection = new SolanaConnectionManager({ rpcUrl, wsUrl });

// NEW:
import { getSharedConnection } from '@solana-eda/solana-client';
// ...
this.connection = getSharedConnection();
```

**Pros:**
- Simple implementation
- Single connection to RPC provider
- Automatic resource sharing
- Workers don't need to manage connection lifecycle

**Cons:**
- Global state (could cause issues in tests)
- One worker's error could affect others
- Need careful shutdown handling

### Option 2: Connection Proxy Service

**Create a separate microservice that handles all RPC calls:**

```
Workers → HTTP API → RPC Proxy Service → RPC Provider
                      (manages rate limiting)
```

**Pros:**
- Clean separation
- Centralized rate limiting control
- Workers can be restarted independently

**Cons:**
- More infrastructure
- Network latency
- Single point of failure

### Option 3: Worker Coordination via Redis

**Workers coordinate their requests through Redis:**

```typescript
// Rate limit coordination through Redis
await redis.acquireRateLimitSlot('rpc-requests');
// Make RPC call
await redis.releaseRateLimitSlot('rpc-requests');
```

**Pros:**
- Distributed coordination
- No single point of failure
- Workers remain independent

**Cons:**
- More complex implementation
- Latency from Redis calls
- Requires Redis to be always available

## Recommended Implementation: Option 1 (Singleton)

### Phase 1: Create Shared Connection Module (1 hour)

**File:** `packages/solana-client/src/shared-connection.ts`

```typescript
import { SolanaConnectionManager, ConnectionConfig } from './connection';

let sharedConnection: SolanaConnectionManager | null = null;
let refCount = 0;

export function getSharedConnection(): SolanaConnectionManager {
  if (!sharedConnection) {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const wsUrl = process.env.SOLANA_WS_URL;

    sharedConnection = new SolanaConnectionManager({
      rpcUrl,
      wsUrl,
      usePool: false, // Use single connection to same URL
    });

    console.log('[SharedConnection] Created shared connection manager for:', rpcUrl);
  }

  refCount++;
  console.log(`[SharedConnection] Reference count: ${refCount}`);

  return sharedConnection;
}

export async function releaseSharedConnection(): Promise<void> {
  refCount--;
  console.log(`[SharedConnection] Reference count: ${refCount}`);

  if (refCount <= 0 && sharedConnection) {
    await sharedConnection.close();
    sharedConnection = null;
    console.log('[SharedConnection] Closed shared connection manager');
    refCount = 0;
  }
}

export async function closeSharedConnection(): Promise<void> {
  if (sharedConnection) {
    await sharedConnection.close();
    sharedConnection = null;
  }
  refCount = 0;
}

export function getConnectionStats() {
  return {
    isInitialized: sharedConnection !== null,
    refCount,
    rpcUrl: sharedConnection?.getRpcUrl(),
  };
}
```

### Phase 2: Update Package Exports (5 minutes)

**File:** `packages/solana-client/src/index.ts`

Add:
```typescript
export * from './shared-connection';
```

### Phase 3: Update All Workers (2 hours)

**Pattern for each worker:**

```typescript
// OLD:
import { SolanaConnectionManager } from '@solana-eda/solana-client';
// ...
constructor() {
  const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
  const wsUrl = process.env.SOLANA_WS_URL || 'wss://api.mainnet-beta.solana.com';
  this.connection = new SolanaConnectionManager({ rpcUrl, wsUrl });
}
// ...
async stop() {
  // ...
  await this.connection.close();
}

// NEW:
import { getSharedConnection, releaseSharedConnection } from '@solana-eda/solana-client';
// ...
constructor() {
  this.connection = getSharedConnection();
}
// ...
async stop() {
  // ...
  await releaseSharedConnection();
}
```

**Workers to update:**
1. `workers/burn-detector/src/index.ts`
2. `workers/liquidity-monitor/src/index.ts`
3. `workers/price-aggregator/src/index.ts`
4. `workers/trading-bot/src/index.ts`
5. `workers/market-detector/src/index.ts`

### Phase 4: Add Connection Monitoring (30 minutes)

**Add health status to worker status events:**

```typescript
private async updateWorkerStatus(status: 'RUNNING' | 'STOPPED' | 'ERROR') {
  const connectionStats = getConnectionStats();

  const metrics = {
    ...this.metrics,
    sharedConnection: {
      active: connectionStats.isInitialized,
      refCount: connectionStats.refCount,
      rpcUrl: connectionStats.rpcUrl,
    },
  };
  // ... rest of status update
}
```

### Phase 5: Testing (1 hour)

**Test scenarios:**
1. Single worker starts → Connection created
2. Multiple workers start → Same connection reused
3. Worker stops → Connection stays alive (other workers using it)
4. All workers stop → Connection closes
5. Worker restart → Connection reused

### Phase 6: Documentation (30 minutes)

Update documentation with shared connection pattern.

## Success Metrics

1. RPC provider sees **1 connection** instead of 5
2. No increase in rate limit errors
3. Workers maintain same functionality
4. Connection properly closes when all workers stopped
5. No memory leaks from connection sharing

## Rollback Plan

If issues arise:
1. Workers can revert to individual connections
2. No breaking changes to worker interfaces
3. Simple import statement changes to revert

## Timeline

- Phase 1: 1 hour (Create shared connection module)
- Phase 2: 5 minutes (Update exports)
- Phase 3: 2 hours (Update 5 workers)
- Phase 4: 30 minutes (Add monitoring)
- Phase 5: 1 hour (Testing)
- Phase 6: 30 minutes (Documentation)

**Total:** ~5 hours

## Implementation Order

1. Create `packages/solana-client/src/shared-connection.ts`
2. Update `packages/solana-client/src/index.ts` exports
3. Update `burn-detector` worker
4. Update `liquidity-monitor` worker
5. Update `price-aggregator` worker
6. Update `trading-bot` worker
7. Update `market-detector` worker
8. Add connection monitoring
9. Test all workers together
10. Update documentation

## Important Notes

- This is a **singleton pattern** - all workers share ONE connection
- The connection uses **rate limiting** internally to manage request distribution
- WebSocket subscriptions from multiple workers will use the **same WS connection**
- Worker shutdown logic changed to use `releaseSharedConnection()` instead of `close()`
- Reference counting ensures connection stays alive as long as any worker needs it
