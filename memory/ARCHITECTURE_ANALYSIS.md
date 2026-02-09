# Architecture Analysis Notes

## Key Findings from Mainnet Readiness Assessment (2026-02-09)

### Critical Issues Identified

1. **Redis Pub/Sub Event Loss (HIGH)**
   - Redis pub/sub is fire-and-forget, events lost if consumer is down
   - No replay mechanism for failures
   - Solution: Migrate to Redis Streams or Kafka

2. **RPC Connection Pool Not Integrated (HIGH)**
   - ConnectionPool class exists in `/packages/solana-client/src/batch-client.ts` but not used
   - Single connection per worker creates single point of failure
   - Solution: Integrate ConnectionPool into SolanaConnectionManager

3. **Missing Transaction Priority Fees (HIGH)**
   - No priority fee calculation for DEX trades
   - No Compute Unit budget management
   - Trades will fail on congested mainnet
   - Solution: Implement PriorityFeeManager class

### Medium Priority Issues

4. **Synchronous DEX Quote Aggregation**
   - Waits for all DEXes, slowest determines latency
   - No timeout per DEX

5. **No Dead Letter Queue**
   - Failed events have no recovery path
   - No audit log for processing

## Architecture Patterns in This Codebase

### Event Flow
```
Solana RPC/WS -> Workers -> Redis Pub/Sub -> Trading Bot -> DEX Aggregator
```

### Multi-DEX Pattern
```
DEXAggregator.getBestQuote() -> Parallel quotes from all DEXes -> Select best
```

### Worker Pattern
```
- Subscribe to Redis channel
- Process events with validation (Zod schemas)
- Persist to Postgres via repositories
- Emit result events
```

## Important File Locations

### Core Infrastructure
- `/packages/solana-client/src/connection.ts` - Connection manager (needs pooling)
- `/packages/solana-client/src/batch-client.ts` - Has ConnectionPool (not integrated!)
- `/packages/solana-client/src/dex-aggregator.ts` - Multi-DEX aggregator
- `/packages/solana-client/src/rate-limiter.ts` - Per-RPC rate limiting

### Event System
- `/packages/events/src/index.ts` - Event schemas and channels
- `/packages/events/src/deduplication.ts` - Event deduplication utilities

### Workers
- `/workers/trading-bot/src/index.ts` - Trading strategy worker
- `/workers/burn-detector/src/index.ts` - Token burn detection
- `/workers/liquidity-monitor/src/index.ts` - Pool liquidity tracking
- `/workers/price-aggregator/src/index.ts` - Price aggregation

## Key Design Decisions

1. **Monorepo with pnpm** - Shared packages for reuse
2. **Zod for event validation** - Type-safe event schemas
3. **Prisma for database** - Repository pattern for data access
4. **Multi-DEX via aggregator** - Single interface to all DEXes
5. **Redis as message broker** - Currently pub/sub, should migrate to Streams

## Technical Debt

1. ConnectionPool exists but unused
2. No priority fee management (mainnet blocker)
3. Event system lacks durability
4. No partitioning for horizontal scaling
5. WebSocket reconnection is basic (no backoff)
