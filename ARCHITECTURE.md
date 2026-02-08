# Solana EDA - Architecture Plan

## Overview

Event-driven architecture (EDA) for Solana on-chain data monitoring and trading automation. Workers subscribe to Solana network events, process them through an ETL pipeline, and trigger trading actions based on defined strategies.

## Architecture

```
┌─────────────────┐
│   Solana RPC    │
│   / WebSocket   │
└────────┬────────┘
         │ (events)
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Workers Layer  │────▶│  Message Broker │
│  (Subscribers)  │     │   (Redis/Kafka)  │
└─────────────────┘     └────────┬────────┘
                                │ (processed events)
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
        ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
        │   API (Nest) │ │  Next.js FE │ │  Worker Pool │
        │             │ │             │ │  (Traders)  │
        └─────────────┘ └─────────────┘ └─────────────┘
```

## Components

### 1. Workers Layer (ETL Pipeline)

Workers subscribe to Solana account changes and program logs. Each worker handles a specific event type.

**Initial Workers:**

| Worker | Purpose | Events |
|--------|---------|--------|
| `liquidity-pool-monitor` | Track liquidity pool changes | Pool state updates, liquidity adds/removes |
| `burn-detector` | Detect token burn events | Token burns, supply changes |
| `price-aggregator` | Aggregate price data from multiple sources | DEX trades, oracle updates |

**Worker Responsibilities:**
- Subscribe to Solana accounts via WebSocket
- Filter and transform raw data
- Emit structured events to message broker
- Maintain state for tracking (e.g., burn history, pool metrics)

### 2. Message Broker

Central event bus connecting workers, API, and trading workers.

**Options:**
- Redis (lightweight, pub/sub)
- Kafka (higher throughput, durable)
- RabbitMQ (flexible routing)

*Decision: Start with Redis for simplicity, can scale to Kafka later.*

**Event Schema:**
```typescript
interface SolanaEvent {
  type: string;          // e.g., 'token_burn', 'pool_liquidity_change'
  timestamp: number;
  slot: number;
  signature: string;
  data: unknown;
}
```

### 3. API Layer (NestJS)

REST API for:
- Querying historical events
- Worker status monitoring
- Configuration management
- Manual trading triggers
- Dashboard data

**Endpoints:**
- `GET /api/events` - Query events with filters
- `GET /api/workers/status` - Worker health
- `POST /api/trade` - Manual trade trigger
- `GET /api/strategies` - Active trading strategies

### 4. Frontend (Next.js)

Dashboard for:
- Real-time event monitoring
- Worker status visualization
- Strategy performance metrics
- Manual controls
- Historical data charts

**Pages:**
- `/dashboard` - Overview with live feeds
- `/workers` - Worker management
- `/strategies` - Trading strategy config
- `/history` - Event history explorer

### 5. Trading Workers

Workers that react to processed events and execute trades.

**Initial Strategies:**
- `burn-and-buy` - Buy after detecting significant token burns
- `liquidity-swing` - Trade on liquidity pool swings
- `arb-bot` - Arbitrage between DEXes

**Safety Mechanisms:**
- Slippage tolerance
- Position size limits
- Stop-loss conditions
- Rate limiting

## Technology Stack

| Layer | Tech | Why |
|-------|------|-----|
| Monorepo | pnpm + Turborepo | Fast, efficient workspaces |
| API | NestJS | TypeScript, modular, battle-tested |
| Frontend | Next.js 14+ | App Router, TypeScript, great DX |
| Solana | @solana/web3.js | Official Solana SDK |
| Broker | Redis | Simple pub/sub, fast |
| Database | PostgreSQL (via Prisma) | Reliable, relational data |
| UI | shadcn/ui + Tailwind | Modern, customizable |

## Event Flow Example: Token Burn → Buy

```
1. burn-detector subscribes to token mint account
2. Solana emits account change (supply decreased)
3. burn-detector processes, extracts burn amount
4. burn-detector emits token_burn event to Redis
5. burn-and-buy worker consumes event
6. Worker checks strategy conditions:
   - Burn amount > threshold?
   - Recent burn trend?
   - Liquidity sufficient?
7. If conditions met, execute buy on DEX
8. Record trade in database
9. API updates frontend with new position
```

## Project Structure

```
solana-eda/
├── apps/
│   ├── api/              # NestJS API
│   └── frontend/         # Next.js 14 frontend (App Router)
├── workers/
│   ├── liquidity-monitor/    # Monitors DEX liquidity pool changes
│   ├── burn-detector/        # Detects token burn events
│   ├── price-aggregator/     # Aggregates prices from multiple DEXes
│   └── trading-bot/          # Trading strategy worker
├── packages/
│   ├── config/            # Shared configuration
│   ├── database/          # Prisma ORM + repositories
│   ├── error-handling/    # Error handling utilities
│   ├── events/            # Event schemas, Redis pub/sub
│   ├── monitoring/        # Logging, health checks
│   ├── solana-client/     # Solana connection, DEX clients
│   └── types/             # Shared TypeScript types
├── pnpm-workspace.yaml
├── package.json
├── turbo.json
├── docker-compose.yml
└── Dockerfile
```

## Implementation Status

### ✅ Phase 1: Foundation (Complete)
   - Set up NestJS API with modular architecture
   - Set up Next.js 14 frontend with App Router
   - Set up Redis for pub/sub messaging
   - Created shared packages (types, events, database, monitoring, config)
   - PostgreSQL database with Prisma ORM

### ✅ Phase 2: Initial Workers (Complete)
   - Implemented `burn-detector` worker - detects token burn events via Token Program logs
   - Implemented `liquidity-monitor` worker - tracks DEX pool state changes
   - Implemented `price-aggregator` worker - aggregates prices from multiple DEX sources
   - Connected to Solana WebSocket via SolanaConnectionManager
   - Emit structured events to Redis channels

### ✅ Phase 3: Trading Bot (Complete)
   - Implemented `trading-bot` worker with configurable strategies
   - **Multi-DEX Aggregator Integration** - Supports all major Solana DEXes:
     - **Jupiter**: Best price aggregator via REST API (most popular, fastest quotes)
     - **Orca**: Whirlpool pools (via Jupiter routing for simplicity)
     - **Meteora**: DLMM pools (via Jupiter routing for simplicity)
     - **Raydium**: AMM pools (via Jupiter routing for simplicity)
   - **DEX Quote Comparison**: Aggregator gets quotes from all enabled DEXes and executes on best route
   - Safety mechanisms: slippage protection, position limits, stop-loss, take-profit
   - Trade settings repository for per-strategy configuration

### ✅ Phase 4: Dashboard (Complete)
   - Built real-time event feed with Socket.IO
   - Worker status monitoring with auto-refresh
   - Strategy performance tracking with P&L charts
   - **New Pages**: `/events`, `/positions`, `/workers`, `/settings`
   - **Charts**: P&L (line), Volume (bar), Burn Trend (area), Win Rate (donut)
   - Frontend utilities: API client, custom hooks (usePolling, useSocket)

## Technology Stack

| Layer | Tech | Why |
|-------|------|-----|
| Monorepo | pnpm + Turborepo | Fast, efficient workspaces |
| API | NestJS | TypeScript, modular, battle-tested |
| Frontend | Next.js 14+ | App Router, TypeScript, great DX |
| Solana | @solana/web3.js | Official Solana SDK |
| DEX Integration | Jupiter API + @jup-ag/api | Unified routing to all DEXes |
| Broker | Redis | Simple pub/sub, fast |
| Database | PostgreSQL (via Prisma) | Reliable, relational data |
| UI | shadcn/ui (Radix) + Tailwind | Modern, customizable |
| Charts | Recharts | Flexible, React-friendly |
| Containerization | Docker + docker-compose | Easy deployment, dev environment |

## Docker Support

The project includes Docker support for local development and production deployment.

### Docker Compose Services

```yaml
services:
  postgres:    # PostgreSQL database
  redis:       # Redis message broker
  api:         # NestJS API (port 3000)
  frontend:    # Next.js frontend (port 3001)
```

### Usage

```bash
# Start infrastructure (postgres + redis)
docker compose up postgres redis -d

# Start all services
docker compose up

# Build and run
docker compose up --build
```

## Configuration

Environment variables are managed via `.env` files in each app/worker.

### Infrastructure
- `REDIS_URL` - Redis message broker connection (default: `redis://localhost:6379`)
- `DATABASE_URL` - PostgreSQL connection (default: `postgresql://postgres:postgres@localhost:5432/solana_eda`)

### Solana
- `SOLANA_RPC_URL` - Mainnet/devnet RPC endpoint (default: `https://api.devnet.solana.com`)
- `SOLANA_WS_URL` - WebSocket endpoint (optional, derived from RPC URL)

### Trading
- `TRADING_PRIVATE_KEY` - Wallet private key for trading (base64 encoded)
- `MIN_BURN_THRESHOLD` - Minimum burn amount to trigger trades (default: `1000000`)
- `MAX_POSITIONS` - Maximum concurrent positions (default: `5`)
- `MAX_SLIPPAGE_BPS` - Maximum slippage in basis points (default: `300` = 3%)

### Workers
- `WORKER_NAME` - Worker identifier (default: derived from directory)
- `TRACKED_TOKENS` - Comma-separated list of token mint addresses to track
- `PRICE_POLL_INTERVAL` - Price aggregation interval in ms (default: `10000`)
- `MONITORED_POOLS` - Comma-separated list of pool addresses to monitor
- `CHANGE_THRESHOLD` - Minimum liquidity change % to emit events (default: `5`)

### API/Frontend
- `FRONTEND_URL` - Frontend URL for CORS (default: `http://localhost:3001`)
- `NEXT_PUBLIC_API_URL` - API URL for frontend (default: `http://localhost:3000`)

## Known Limitations & Future Work

### DEX Integration
- Currently uses Jupiter API as unified routing layer for all DEXes (Orca, Raydium, Meteora)
- Direct SDK integration would require known pool addresses/registry for each DEX
- Some DEX pools may not exist on devnet - test on mainnet for production

### Scalability
- Redis pub/sub is sufficient for current scale
- For higher throughput, consider Kafka for durable event streaming
- Prisma connection pooling recommended for production

### Testing
- Add integration tests for DEX swap execution
- Add end-to-end tests for trading strategies
- Mock Jupiter API responses for testing
