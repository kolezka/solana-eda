# RPC Shared Connection Fix - Correct Architecture

## The Real Problem

**Current Issue:**
- 5 workers are **5 separate Node.js processes**
- Each process creates its own `SolanaConnectionManager` instance
- Each instance creates its own HTTP/WebSocket connections to the RPC provider
- RPC provider sees **5 separate connections** and rate limits them

**Why Singleton Won't Work:**
```
Process 1 (burn-detector)     → Connection A → RPC Provider
Process 2 (liquidity-monitor)  → Connection B → RPC Provider
Process 3 (price-aggregator)   → Connection C → RPC Provider
Process 4 (trading-bot)        → Connection D → RPC Provider
Process 5 (market-detector)    → Connection E → RPC Provider

Each process has its OWN memory space.
Singleton in one process ≠ Singleton in another process.
```

## Actual Solution Options

### Option 1: RPC Proxy Service (Recommended)

**Architecture:**
```
Workers → HTTP/WebSocket → RPC Proxy Service → RPC Provider
         (5 processes)       (1 process)         (sees 1 connection)
```

**Implementation:**

Create a new worker/service that acts as an RPC proxy:

```typescript
// workers/rpc-proxy/src/index.ts
import express from 'express';
import { SolanaConnectionManager } from '@solana-eda/solana-client';
import { createServer } from 'http';

const app = express();
app.use(express.json());

// Single connection for all workers
const connection = new SolanaConnectionManager({
  rpcUrl: process.env.SOLANA_RPC_URL,
  wsUrl: process.env.SOLANA_WS_URL,
});

// HTTP endpoints for common RPC methods
app.post('/rpc/getAccountInfo', async (req, res) => {
  try {
    const result = await connection.getAccountInfo(req.body.publicKey);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/rpc/getTransaction', async (req, res) => {
  try {
    const result = await connection.getTransaction(req.body.signature);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// WebSocket endpoint for subscriptions
const server = createServer(app);
const wsServer = new WebSocket.Server({ server, path: '/ws' });

// Handle WebSocket subscriptions from workers
wsServer.on('connection', (ws) => {
  // Forward subscriptions to actual Solana WS connection
  // Broadcast updates to all subscribed workers
});

server.listen(3001, () => {
  console.log('RPC Proxy listening on port 3001');
});
```

**Worker changes:**

```typescript
// Create a custom connection class that uses the proxy
class ProxiedSolanaConnection {
  private proxyUrl: string;

  constructor(proxyUrl: string) {
    this.proxyUrl = proxyUrl;
  }

  async getAccountInfo(publicKey: PublicKey) {
    const response = await fetch(`${this.proxyUrl}/rpc/getAccountInfo`, {
      method: 'POST',
      body: JSON.stringify({ publicKey: publicKey.toBase58() }),
      headers: { 'Content-Type': 'application/json' },
    });
    return response.json();
  }

  // ... other methods
}

// In worker:
const connection = new ProxiedSolanaConnection('http://localhost:3001');
```

**Pros:**
- Single connection to RPC provider
- Centralized rate limiting control
- Can add caching, retry logic, monitoring
- Workers remain independent processes

**Cons:**
- More infrastructure (additional service)
- Network latency (localhost → fast, remote → slower)
- Single point of failure (need health checks)
- More complex deployment

### Option 2: Sidecar Process with IPC

**Architecture:**
```
┌─────────────────────────────────────┐
│     RPC Sidecar Process             │
│  (holds the actual connection)      │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  IPC Server (Unix Socket)    │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
           ▲        ▲        ▲
           │        │        │
    Worker 1  Worker 2  Worker 3...
 (IPC clients)
```

**Implementation:**

```typescript
// workers/rpc-sidecar/src/index.ts
import { Server } from 'net';
import { SolanaConnectionManager } from '@solana-eda/solana-client';
import fs from 'fs';

const SOCKET_PATH = '/tmp/solana-rpc.sock';

// Single connection
const connection = new SolanaConnectionManager({
  rpcUrl: process.env.SOLANA_RPC_URL,
  wsUrl: process.env.SOLANA_WS_URL,
});

// IPC server using Unix domain socket
if (fs.existsSync(SOCKET_PATH)) {
  fs.unlinkSync(SOCKET_PATH);
}

const server = new Server((socket) => {
  socket.on('data', async (data) => {
    try {
      const request = JSON.parse(data.toString());

      let result;
      switch (request.method) {
        case 'getAccountInfo':
          result = await connection.getAccountInfo(request.params.publicKey);
          break;
        case 'getTransaction':
          result = await connection.getTransaction(request.params.signature);
          break;
        // ... other methods
      }

      socket.write(JSON.stringify({ result }));
    } catch (error) {
      socket.write(JSON.stringify({ error: error.message }));
    }
  });

  socket.on('error', (err) => {
    console.error('IPC socket error:', err);
  });
});

server.listen(SOCKET_PATH, () => {
  console.log(`RPC sidecar listening on ${SOCKET_PATH}`);
});
```

**Worker changes:**

```typescript
import { Socket } from 'net';
import { PublicKey } from '@solana/web3.js';

class IPCSolanaConnection {
  private socket: Socket;
  private requestId = 0;

  constructor(socketPath: string) {
    this.socket = new Socket();
    this.socket.connect(socketPath);
  }

  async getAccountInfo(publicKey: PublicKey) {
    return this.call('getAccountInfo', { publicKey: publicKey.toBase58() });
  }

  private async call(method: string, params: any) {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;

      const request = JSON.stringify({ id, method, params });
      this.socket.write(request);

      // Listen for response
      const handler = (data: Buffer) => {
        const response = JSON.parse(data.toString());
        if (response.id === id) {
          this.socket.off('data', handler);
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.result);
          }
        }
      };

      this.socket.on('data', handler);
    });
  }
}

// In worker:
const connection = new IPCSolanaConnection('/tmp/solana-rpc.sock');
```

**Pros:**
- Single connection to RPC provider
- Fast IPC (no TCP overhead)
- Low latency
- Simple deployment (runs on same host)

**Cons:**
- Only works on same host (no distributed support)
- Need to manage sidecar process lifecycle
- Socket file management

### Option 3: Managed Connection Pool Service (Most Robust)

**Architecture:**
```
┌──────────────────────────────────────┐
│   Connection Pool Service            │
│                                      │
│  ┌────────────────────────────────┐ │
│  │  Single Connection Pool         │ │
│  │  (Health checks, failover)      │ │
│  └────────────────────────────────┘ │
│                                      │
│  ┌────────────────────────────────┐ │
│  │  Redis Pub/Sub for WS events   │ │
│  └────────────────────────────────┘ │
└──────────────────────────────────────┘
         ▲                    ▲
         │                    │
    Workers (HTTP API)    Workers (Redis)
```

**Combines:**
- HTTP API for query/submit operations
- Redis pub/sub for WebSocket subscription events
- Single connection pool with all the existing RpcConnectionPool features

**Pros:**
- Single connection to RPC provider
- Uses existing infrastructure (Redis)
- Can be distributed across hosts
- Full connection pooling features
- WebSocket events via Redis (workers already use Redis)

**Cons:**
- Most complex to implement
- Still a single point of failure (need HA)

## Recommended Implementation: Option 2 (Sidecar with IPC)

**Why IPC Sidecar:**
1. **Fast** - Unix domain sockets are very fast (no TCP overhead)
2. **Simple** - Runs on same host, no network complexity
3. **Reliable** - Can monitor sidecar health and restart if needed
4. **Low overhead** - Minimal latency compared to HTTP
5. **Uses existing code** - Can wrap existing `SolanaConnectionManager`

## Implementation Plan

### Phase 1: Create RPC Sidecar (2 hours)

**New worker:** `workers/rpc-sidecar/`

```typescript
// workers/rpc-sidecar/src/index.ts
import { Server } from 'net';
import { SolanaConnectionManager, RpcConnectionPool } from '@solana-eda/solana-client';
import fs from 'fs';
import { WebSocketServer } from 'ws';

const SOCKET_PATH = process.env.RPC_SIDECAR_SOCKET || '/tmp/solana-rpc.sock';
const WS_PORT = parseInt(process.env.RPC_SIDECAR_WS_PORT || '3002');

// Use existing connection pooling infrastructure
const pool = createRpcPoolFromEnv();
const connection = new SolanaConnectionManager({
  rpcUrl: process.env.SOLANA_RPC_URL,
  wsUrl: process.env.SOLANA_WS_URL,
  usePool: true,
});

// IPC server for RPC calls
const ipcServer = new Server((socket) => {
  socket.on('data', async (data) => {
    // Handle RPC requests
  });
});

// WebSocket server for subscriptions
const wsServer = new WebSocketServer({ port: WS_PORT });
wsServer.on('connection', (ws) => {
  // Handle subscription requests
  // Forward to actual Solana WS connection
  // Broadcast updates to subscribers
});
```

### Phase 2: Update Workers (3 hours)

**Create shared client library:**

```typescript
// packages/solana-client/src/sidecar-client.ts
export class SidecarConnection {
  private ipcClient: Socket;
  private wsClient: WebSocket;

  constructor(socketPath: string, wsUrl: string) {
    this.ipcClient = new Socket();
    this.ipcClient.connect(socketPath);
    this.wsClient = new WebSocket(wsUrl);
  }

  async getAccountInfo(publicKey: PublicKey) {
    // IPC call to sidecar
  }

  onLogs(callback: (logs: any) => void) {
    // WebSocket subscription via sidecar
  }
}
```

**Update each worker to use sidecar:**

```typescript
// In each worker:
import { SidecarConnection } from '@solana-eda/solana-client';

constructor() {
  const socketPath = process.env.RPC_SIDECAR_SOCKET || '/tmp/solana-rpc.sock';
  const wsUrl = process.env.RPC_SIDECAR_WS_URL || 'ws://localhost:3002';

  this.connection = new SidecarConnection(socketPath, wsUrl);
}
```

### Phase 3: Sidecar Lifecycle Management (1 hour)

**Add to docker-compose.yml:**

```yaml
services:
  rpc-sidecar:
    build: ./workers/rpc-sidecar
    environment:
      - SOLANA_RPC_URL=${SOLANA_RPC_URL}
      - SOLANA_WS_URL=${SOLANA_WS_URL}
      - RPC_SIDECAR_SOCKET=/tmp/solana-rpc.sock
      - RPC_SIDECAR_WS_PORT=3002
    volumes:
      - /tmp:/tmp
    restart: unless-stopped

  # Workers depend on sidecar
  burn-detector:
    depends_on:
      - rpc-sidecar
    environment:
      - RPC_SIDECAR_SOCKET=/tmp/solana-rpc.sock
      - RPC_SIDECAR_WS_URL=ws://rpc-sidecar:3002
```

### Phase 4: Monitoring & Health Checks (1 hour)

**Add sidecar health to worker status:**

```typescript
// Check sidecar availability
private async checkSidecarHealth(): Promise<boolean> {
  try {
    await this.connection.ping();
    return true;
  } catch {
    return false;
  }
}

// Include in worker status
private async updateWorkerStatus(status: 'RUNNING' | 'STOPPED' | 'ERROR') {
  const sidecarHealthy = await this.checkSidecarHealth();

  const metrics = {
    ...this.metrics,
    sidecarConnection: {
      healthy: sidecarHealthy,
      socketPath: process.env.RPC_SIDECAR_SOCKET,
    },
  };
}
```

### Phase 5: Testing (2 hours)

**Test scenarios:**
1. Sidecar starts, workers connect → Single connection to RPC
2. Sidecar dies → Workers detect and reconnect when sidecar restarts
3. Multiple workers → All use same sidecar connection
4. WebSocket subscriptions → Events forwarded to all subscribers
5. High load → Rate limiting handled by sidecar

### Phase 6: Documentation (1 hour)

## Success Metrics

1. RPC provider sees **1 connection** (from sidecar)
2. All workers connect to sidecar via IPC/WebSocket
3. Latency increase < 5ms compared to direct connections
4. Sidecar restart doesn't require worker restarts
5. WebSocket events properly forwarded to all workers

## Timeline

- Phase 1: 2 hours (Create sidecar)
- Phase 2: 3 hours (Create client, update workers)
- Phase 3: 1 hour (Docker/lifecycle)
- Phase 4: 1 hour (Monitoring)
- Phase 5: 2 hours (Testing)
- Phase 6: 1 hour (Documentation)

**Total:** ~10 hours

## Architecture Diagram

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
                    │ (sees 1 conn)    │
                    └─────────────────┘
```

## Rollback Plan

If issues arise:
1. Workers can revert to direct connections
2. Set environment variable `USE_SIDECAR=false`
3. Workers check this and use direct `SolanaConnectionManager`
