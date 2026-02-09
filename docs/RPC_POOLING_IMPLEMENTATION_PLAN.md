# RPC Connection Pooling Implementation Plan

## Problem Statement

Each worker (burn-detector, liquidity-monitor, price-aggregator, trading-bot, market-detector) creates its own `SolanaConnectionManager` instance with separate RPC connections. This leads to:

- **Rate limit exhaustion** - Each worker hits rate limits independently
- **Inefficient resource usage** - Multiple connections to same endpoints
- **No load balancing** - All requests go through single endpoint
- **No failover** - Single endpoint failure affects entire worker
- **Connection overhead** - Each WebSocket connection consumes resources

## Current State Analysis

### Existing Infrastructure (Already Built)

**`packages/solana-client/src/rpc-pool.ts`:**
- `RpcConnectionPool` class with health checking, failover, load balancing
- `createRpcPoolFromEnv()` function that reads `SOLANA_RPC_URLS` environment variable
- Per-endpoint rate limiting
- Connection health monitoring with configurable thresholds
- Automatic retry with failover

**`packages/solana-client/src/connection.ts`:**
- `SolanaConnectionManager` already supports pooling via `usePool` config option
- Methods like `getConnection()`, `getSubmitConnection()`, `getQueryConnection()` use pool when enabled
- `executeWithPool()` method for automatic failover operations

### Current Worker Implementation Issues

**Workers NOT using pooling:**
1. `burn-detector` (line 83): `new SolanaConnectionManager({ rpcUrl, wsUrl })`
2. `liquidity-monitor` (line 111): `new SolanaConnectionManager({ rpcUrl })`
3. `trading-bot` (line 73): `new SolanaConnectionManager({ rpcUrl })`
4. `market-detector` - Need to verify

**Worker using pooling (PARTIALLY):**
1. `price-aggregator` (lines 92-100): Has detection logic but not fully integrated

### Missing Configuration

No environment variable setup in `.env` files for `SOLANA_RPC_URLS`.

## Implementation Plan

### Phase 1: Environment Configuration (1 hour)

**Files to modify:**
1. `.env.example` - Add `SOLANA_RPC_URLS` with sample configuration
2. `docker-compose.yml` - No changes needed (RPC URLs are external)

**Environment variable schema:**
```bash
# Primary RPC endpoint (used as priority 1)
SOLANA_RPC_URL=https://your-primary-rpc.com

# Additional endpoints (comma-separated, used as fallbacks)
SOLANA_RPC_URLS=https://your-primary-rpc.com,https://fallback1.com,https://fallback2.com

# WebSocket URL (optional - if not provided, derived from RPC)
SOLANA_WS_URL=wss://your-primary-rpc.com

# Health check interval (optional, default 30000ms)
SOLANA_RPC_HEALTH_CHECK_INTERVAL=30000
```

### Phase 2: Update Workers to Use Pooling (2-3 hours)

**Standard pattern for all workers:**

```typescript
constructor() {
  // OLD: Single connection
  // this.connection = new SolanaConnectionManager({ rpcUrl, wsUrl });

  // NEW: Connection pooling with automatic detection
  const rpcUrls = process.env.SOLANA_RPC_URLS?.split(',').map(u => u.trim()) || [];
  const usePool = rpcUrls.length > 1;

  this.connection = new SolanaConnectionManager({
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    wsUrl: process.env.SOLANA_WS_URL,
    usePool, // Enable pooling if multiple URLs detected
  });

  if (usePool) {
    console.log(`[${this.workerName}] RPC pooling enabled with ${rpcUrls.length} endpoints`);
  }
}
```

**Workers to update:**
1. `workers/burn-detector/src/index.ts` - Line 77-85
2. `workers/liquidity-monitor/src/index.ts` - Line 101-117
3. `workers/trading-bot/src/index.ts` - Line 64-76
4. `workers/market-detector/src/index.ts` - Need to verify and update
5. `workers/price-aggregator/src/index.ts` - Already has detection, needs integration

### Phase 3: Add Pool Metrics to Worker Status (1 hour)

**Extend worker status reporting to include pool statistics:**

```typescript
private async updateWorkerStatus(status: 'RUNNING' | 'STOPPED' | 'ERROR', error?: string) {
  const poolStats = this.connection.isPoolingEnabled()
    ? this.connection.getPoolStats()
    : null;

  const metrics = {
    ...this.metrics,
    uptime: Date.now() - this.metrics.startTime,
    rpcPooling: this.connection.isPoolingEnabled(),
    rpcEndpoints: poolStats ? {
      query: poolStats.get('query')?.length || 0,
      submit: poolStats.get('submit')?.length || 0,
      healthyEndpoints: Array.from(poolStats.values())
        .flat()
        .filter(s => s.healthy).length,
    } : null,
  };
  // ... rest of status update
}
```

### Phase 4: Testing & Validation (2 hours)

**Test scenarios:**
1. Single RPC endpoint - Should work as before
2. Multiple RPC endpoints - Should distribute load
3. Primary endpoint failure - Should failover to secondary
4. All endpoints failure - Should handle gracefully
5. WebSocket connections - Should use primary endpoint
6. Rate limiting - Should respect per-endpoint limits

**Validation checklist:**
- [ ] All workers start successfully with `SOLANA_RPC_URLS` set
- [ ] Workers log "RPC pooling enabled" message
- [ ] Pool statistics appear in worker status
- [ ] Failover works when primary endpoint fails
- [ ] WebSocket subscriptions still work
- [ ] No increase in error rates

### Phase 5: Documentation Updates (1 hour)

**Files to update:**
1. `README.md` - Add RPC pooling configuration section
2. `docs/ARCHITECTURE.md` - Document connection pooling architecture
3. `workers/README.md` - Add pooling configuration for workers

## Success Criteria

1. All workers use shared connection pool when `SOLANA_RPC_URLS` is configured
2. Workers continue to work with single `SOLANA_RPC_URL` (backward compatible)
3. Pool statistics visible in worker status events
4. Automatic failover works without worker restart
5. Rate limits distributed across endpoints

## Rollback Plan

If issues arise:
1. Set `SOLANA_RPC_URLS` to single URL (disables pooling)
2. Workers automatically fall back to single connection mode
3. No code rollback needed (backward compatible)

## Timeline

- **Phase 1 (Environment Config):** 30 minutes
- **Phase 2 (Worker Updates):** 2-3 hours
- **Phase 3 (Metrics):** 1 hour
- **Phase 4 (Testing):** 2 hours
- **Phase 5 (Documentation):** 1 hour

**Total:** ~6-8 hours

## Implementation Order

1. Update `.env.example` with new variables
2. Update `burn-detector` (simplest worker)
3. Update `liquidity-monitor`
4. Update `trading-bot`
5. Update `market-detector`
6. Update `price-aggregator` (has existing logic, needs integration)
7. Add pool metrics to all workers
8. Test all workers together
9. Update documentation

## Notes

- Infrastructure already exists in `packages/solana-client`
- No new dependencies needed
- Backward compatible (works with single URL)
- Workers already import `SolanaConnectionManager` from solana-client
- No breaking changes to worker interfaces
