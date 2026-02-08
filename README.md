# Solana EDA

Event-driven architecture for Solana on-chain monitoring and automated trading.

## What is this?

A monorepo system where:
- **Workers** subscribe to Solana network events (burns, liquidity changes, price updates)
- Events flow through a message broker (Redis)
- **Trading workers** react to events and execute strategies
- **API** (NestJS) serves data and controls
- **Frontend** (Next.js) provides monitoring and management dashboard

## Multi-DEX Support

The trading bot supports **all major Solana DEXes** via Jupiter aggregator:
- **Jupiter**: Best price aggregator (most popular, fastest quotes)
- **Orca**: Whirlpool pools
- **Meteora**: DLMM pools
- **Raydium**: AMM pools

The DEX aggregator automatically compares quotes from all enabled DEXes and executes trades on the best route for optimal pricing.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for full details.

## Quick Start

### Option 1: Docker (Recommended)

```bash
# Start infrastructure (postgres + redis)
docker compose up postgres redis -d

# Start all services
docker compose up

# Or build and run
docker compose up --build
```

### Option 2: Local Development

```bash
# Install dependencies
pnpm install

# Start infrastructure
docker compose up postgres redis -d

# Run database migrations
pnpm db:push

# Run all services in dev mode
pnpm dev
```

The following services will be available:
- API: http://localhost:3000
- Frontend: http://localhost:3001
- PostgreSQL: localhost:5432
- Redis: localhost:6379

## Project Structure

```
solana-eda/
├── apps/
│   ├── api/              # NestJS backend API
│   └── frontend/         # Next.js 14 dashboard
├── workers/
│   ├── burn-detector/        # Detects token burn events
│   ├── liquidity-monitor/    # Monitors DEX pool changes
│   ├── price-aggregator/     # Aggregates prices from DEXes
│   └── trading-bot/          # Trading strategy worker
├── packages/
│   ├── config/            # Shared configuration
│   ├── database/          # Prisma ORM + repositories
│   ├── error-handling/    # Error handling utilities
│   ├── events/            # Event schemas, Redis pub/sub
│   ├── monitoring/        # Logging, health checks
│   ├── solana-client/     # Solana connection, DEX clients
│   └── types/             # Shared TypeScript types
├── docker-compose.yml
├── Dockerfile
├── ARCHITECTURE.md
└── README.md
```

## Tech Stack

- **Monorepo:** pnpm + Turborepo
- **API:** NestJS
- **Frontend:** Next.js 14 + shadcn/ui + Recharts
- **Solana:** @solana/web3.js + @jup-ag/api
- **Message Broker:** Redis (ioredis)
- **Database:** PostgreSQL + Prisma
- **Charts:** Recharts
- **Containerization:** Docker + docker-compose

## Workers

| Worker | Purpose |
|--------|---------|
| `burn-detector` | Detects token burn events via Token Program logs |
| `liquidity-monitor` | Monitors DEX pool state changes (Orca, Raydium) |
| `price-aggregator` | Aggregates prices from multiple DEX sources |
| `trading-bot` | Executes trading strategies based on events |

## Frontend Pages

| Page | Description |
|------|-------------|
| `/` | Dashboard with stats and charts |
| `/events` | Event history with filters |
| `/positions` | Open/closed positions management |
| `/workers` | Worker status monitoring |
| `/settings` | Trading settings configuration |

## Status

✅ **Phase 1-4 Complete** - All phases implemented:
- ✅ Foundation (API, Frontend, Database, Events)
- ✅ Workers (burn-detector, liquidity-monitor, price-aggregator)
- ✅ Multi-DEX Integration (Jupiter, Orca, Raydium, Meteora)
- ✅ Trading Bot with safety mechanisms
- ✅ Dashboard with real-time updates and charts

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed implementation notes.
