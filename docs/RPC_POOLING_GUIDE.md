# RPC Connection Pooling Guide

**Date:** 2026-02-09
**Component:** `@solana-eda/solana-client`
**Status:** Implemented

---

## Overview

The RPC Connection Pooling system provides high availability and load balancing for Solana RPC connections. It automatically manages multiple RPC endpoints with health checking, failover, and per-endpoint rate limiting.

## Architecture

The pooling system implements a **4-pool architecture**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Connection Pool Manager                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ Query Pool   │  │ Submit Pool  │  │ Jupiter Pool │        │
│  │ (Read Ops)   │  │ (Write Ops)  │  │ (HTTP API)   │        │
│  │              │  │              │  │              │        │
│  │ • Fees       │  │ • Submit TX  │  │ • Quotes     │        │
│  │ • Balances   │  │ • Confirm    │  │ • Swaps      │        │
│  │ • Accounts   │  │              │  │              │        │
│  │              │  │              │  │              │        │
│  │ 3+ endpoints│  │ 2+ endpoints │  │ 1+ endpoint   │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │         WebSocket Pool (Subscriptions)                    │    │
│  │  • Pool Accounts  • Logs  • Slots                        │    │
│  │  2-3 dedicated connections for redundancy                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

```bash
# Multiple RPC endpoints (comma-separated) - enables pooling
SOLANA_RPC_URLS=https://rpc1.example.com,https://rpc2.example.com,https://rpc3.example.com

# Primary RPC URL (fallback, used if SOLANA_RPC_URLS not set)
SOLANA_RPC_URL=https://rpc.example.com

# WebSocket URL (optional, derived from RPC if not set)
SOLANA_WS_URL=wss://rpc.example.com

# Health check interval (milliseconds)
SOLANA_RPC_HEALTH_CHECK_INTERVAL=30000

# Jupiter API configuration
JUPITER_API_URL=https://quote-api.jup.ag/v6
JUPITER_BACKUP_URLS=https://backup-jupiter.example.com
JUPITER_REQUEST_TIMEOUT=10000
```

### Programmatic Configuration

```typescript
import { RpcConnectionPool } from '@solana-eda/solana-client';

const pool = new RpcConnectionPool({
  endpoints: [
    {
      url: 'https://rpc1.example.com',
      priority: 1, // Lower = higher priority
      type: ['query', 'submit', 'websocket'],
      maxRequests: 100,
      windowMs: 1000,
    },
    {
      url: 'https://rpc2.example.com',
      priority: 2,
      type: ['query', 'submit'],
    },
    {
      url: 'https://rpc3.example.com',
      priority: 3,
      type: ['query'],
    },
  ],
  healthCheckInterval: 30000,
  unhealthyThreshold: 3,
  healthyThreshold: 2,
  requestTimeout: 10000,
});
```

## Usage

### With SolanaConnectionManager (Recommended)

```typescript
import { SolanaConnectionManager } from '@solana-eda/solana-client';

// Pooling is automatically enabled when SOLANA_RPC_URLS contains multiple URLs
const connection = new SolanaConnectionManager({
  rpcUrl: 'https://rpc.example.com',
  wsUrl: 'wss://rpc.example.com',
  usePool: true, // Explicitly enable pooling
});

// Use connections normally - pooling handles failover
const accountInfo = await connection.getAccountInfo(publicKey);
const signature = await connection.sendRawTransaction(transaction);

// Get pool statistics
const health = await connection.getHealthStatus();
console.log(health.poolStats); // Map<ConnectionType, EndpointStats[]>
```

### Direct Pool Access

```typescript
import { RpcConnectionPool } from '@solana-eda/solana-client';

const pool = new RpcConnectionPool({ endpoints: [...] });

// Execute with automatic failover
const result = await pool.executeWithRetry('query', async (conn) => {
  return await conn.getAccountInfo(publicKey);
});

// Get specific connection type
const queryConn = pool.getConnection('query');
const submitConn = pool.getConnection('submit');

// Get statistics
const stats = pool.getPoolStats();
```

## Connection Types

| Type | Use Case | Example Operations |
|------|----------|-------------------|
| `query` | Read operations | getAccountInfo, getBalance, getTransaction |
| `submit` | Transaction submission | sendRawTransaction, confirmTransaction |
| `websocket` | Subscriptions | onAccountChange, onLogs |
| `jupiter-api` | DEX quotes | getQuote, getSwapTransaction |

## Features

### Automatic Failover

The pool automatically fails over to healthy endpoints when:

- An endpoint exceeds the error threshold
- A request times out
- An endpoint returns an error response

```typescript
// Automatic retry with different endpoints
const result = await pool.executeWithRetry('query', async (conn) => {
  return await conn.getAccountInfo(publicKey);
}, { maxRetries: 3 });
```

### Health Checking

Background health checks run periodically (default: 30 seconds) to:

- Monitor endpoint availability
- Track consecutive errors/successes
- Update latency metrics
- Mark unhealthy endpoints

```typescript
// Manual health check
const stats = pool.getStatsForType('query');
stats.forEach(stat => {
  console.log(`${stat.url}: healthy=${stat.healthy}, latency=${stat.averageLatency}ms`);
});
```

### Rate Limiting

Per-endpoint rate limiting prevents hitting RPC provider limits:

```typescript
// Automatic rate limiting based on provider
// - QuickNode: 100 req/sec
// - Helius: 100 req/sec
// - Public endpoints: 10-20 req/sec
// - Custom: configured per endpoint
```

### Connection Scoring

Endpoints are scored based on:

- **Health status** (healthy endpoints preferred)
- **Consecutive successes** (more = better)
- **Average latency** (lower = better)
- **Current load** (active requests)
- **Total requests** (stability bonus)

## Monitoring

### Pool Statistics

```typescript
const health = await connection.getHealthStatus();

if (health.poolingEnabled && health.poolStats) {
  for (const [poolType, endpoints] of health.poolStats) {
    console.log(`\n${poolType} pool:`);
    endpoints.forEach(ep => {
      console.log(`  ${ep.url}`);
      console.log(`    healthy: ${ep.healthy}`);
      console.log(`    totalRequests: ${ep.totalRequests}`);
      console.log(`    failedRequests: ${ep.failedRequests}`);
      console.log(`    avgLatency: ${ep.averageLatency}ms`);
    });
  }
}
```

### Worker Status Events

Workers using pooling include RPC pool stats in their status events:

```json
{
  "workerName": "price-aggregator",
  "status": "RUNNING",
  "metrics": {
    "rpcPoolEnabled": true,
    "rpcPoolStats": {
      "query": {
        "healthy": "3/3",
        "endpoints": [
          {
            "url": "https://rpc1.example.com",
            "healthy": true,
            "avgLatency": 120,
            "totalRequests": 1523,
            "failedRequests": 2
          }
        ]
      }
    }
  }
}
```

## Best Practices

1. **Always use multiple endpoints**: Configure at least 2-3 RPC endpoints for high availability

2. **Prioritize your endpoints**: Set lower priority values for faster/more reliable endpoints

3. **Separate query and submit pools**: Use different endpoints for reads vs writes to avoid rate limiting

4. **Monitor pool health**: Regularly check pool statistics to identify degraded endpoints

5. **Set appropriate timeouts**: Configure request timeouts based on your use case (default: 10s)

6. **Use appropriate pool types**:
   - Use `query` for reads (can use cheaper endpoints)
   - Use `submit` for transactions (use most reliable endpoints)
   - Use `websocket` for subscriptions (needs stable connections)

## Troubleshooting

### All Endpoints Unhealthy

```typescript
// Emergency reset - marks all endpoints as healthy
pool.resetAllHealth();

// Or mark specific endpoint healthy
pool.markEndpointHealthy('https://rpc.example.com', 'query');
```

### High Error Rates

Check pool statistics to identify problematic endpoints:

```typescript
const stats = pool.getStatsForType('query');
const problemEndpoints = stats.filter(s => s.failedRequests / s.totalRequests > 0.1);
```

### Slow Queries

Review latency metrics and prioritize lower-latency endpoints:

```typescript
const stats = pool.getStatsForType('query');
stats.sort((a, b) => a.averageLatency - b.averageLatency);
console.log('Fastest endpoint:', stats[0].url);
```

## Migration Guide

### From Single Connection

```typescript
// Before
const connection = new Connection(process.env.SOLANA_RPC_URL);

// After
const manager = new SolanaConnectionManager({
  rpcUrl: process.env.SOLANA_RPC_URL!,
  usePool: true, // Enable pooling
});
const connection = manager.getConnection();
```

### From Custom Pooling

```typescript
// Before - custom pooling logic
const connections = urls.map(u => new Connection(u));
const connection = selectHealthyConnection(connections);

// After - built-in pooling
const pool = new RpcConnectionPool({ endpoints: [...] });
const connection = pool.getConnection('query');
```

## API Reference

### RpcConnectionPool

```typescript
class RpcConnectionPool {
  constructor(config: ConnectionPoolConfig)
  getConnection(type: ConnectionType): Connection
  executeWithRetry<T>(type: ConnectionType, fn: (conn) => Promise<T>, options?): Promise<T>
  getPoolStats(): Map<ConnectionType, EndpointStats[]>
  getStatsForType(type: ConnectionType): EndpointStats[]
  markEndpointHealthy(url: string, type?: ConnectionType): void
  resetAllHealth(): void
  close(): Promise<void>
}
```

### SolanaConnectionManager

```typescript
class SolanaConnectionManager {
  constructor(config: ConnectionConfig)
  getConnection(): Connection
  getSubmitConnection(): Connection
  getQueryConnection(): Connection
  isPoolingEnabled(): boolean
  getPoolStats(): Map<ConnectionType, any> | null
  executeWithPool<T>(type: ConnectionType, fn: (conn) => Promise<T>): Promise<T>
  getHealthStatus(): Promise<HealthStatus>
}
```

---

**Related Documentation:**
- [PHASE1_RABBITMQ_RPC_PLAN.md](./PHASE1_RABBITMQ_RPC_PLAN.md) - Original implementation plan
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture overview
