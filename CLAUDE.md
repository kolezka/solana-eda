# CLAUDE.md

This repository implements an event-driven architecture (EDA) for Solana on-chain monitoring + automated trading in a pnpm/Turborepo monorepo. Core components: workers (ETL + traders), Redis pub/sub event bus, NestJS API, Next.js dashboard, PostgreSQL/Prisma.

## How to work in this repo (high level)

- Prefer small, reviewable changes.
- Keep strong boundaries:
  - **workers/**: event ingestion + trading execution
  - **packages/**: shared libraries (events/types/config/db/monitoring/solana-client)
  - **apps/**: API (NestJS) + Frontend (Next.js)
- When adding new features, start from **event schema → producer → broker → consumer → persistence → UI**.

## Architecture (mental model)

- Workers subscribe to Solana RPC/WebSocket events, transform them into structured events, and publish to Redis channels.
- API serves historical events, worker status, configuration, and manual triggers.
- Frontend shows real-time monitoring, workers health, strategies/positions, and charts.

## Local development

Services (default):

- API: http://localhost:3000
- Frontend: http://localhost:3001
- Postgres: localhost:5432
- Redis: localhost:6379

## Configuration (common env vars)

### Infrastructure:

- REDIS_URL (default: redis://localhost:6379)
- DATABASE_URL (default: postgresql://postgres:postgres@localhost:5432/solana_eda)

### Solana:

- SOLANA_RPC_URL (default often devnet)
- SOLANA_WS_URL (optional; can be derived)

### Trading:

- TRADING_PRIVATE_KEY or SOLANA_PRIVATE_KEY (base64 encoded private key)
- MIN_BURN_THRESHOLD
- MAX_POSITIONS
- MAX_SLIPPAGE_BPS

### Workers:

- WORKER_NAME
- TRACKED_TOKENS
- PRICE_POLL_INTERVAL
- MONITORED_POOLS
- CHANGE_THRESHOLD

### Frontend:

- NEXT_PUBLIC_API_URL

### API:

- FRONTEND_URL (CORS)

## Eventing guidelines

### Event schema (conceptual)

Use a structured, versionable event shape (type + timestamp + slot + signature + data).

- Producers (workers) should emit:
  - `type` identifying domain event (e.g., token burn, liquidity change)
  - consistent `data` payload shape per event type
- Consumers should:
  - validate required fields
  - tolerate unknown fields (forward-compat)

### Adding a new event type

1. Define/extend schema/types in packages/types or packages/events.
2. Implement producer worker logic (subscribe → filter → transform → publish).
3. Add consumer handling:
   - trading-bot strategy logic OR API persistence/queries
4. Add observability:
   - logging
   - health checks
   - worker status surfaced in API + UI
5. Add UI surfaces if needed (/events filters, charts, dashboards).

## Worker patterns

### ETL workers

- Connect via shared Solana connection utilities (e.g., SolanaConnectionManager).
- Filter aggressively near the source to avoid noisy streams.
- Maintain minimal state only if required (e.g., burn history, pool metrics).

### Trading worker (trading-bot)

- Reacts to processed events from Redis.
- Applies safety mechanisms:
  - slippage tolerance
  - position sizing limits
  - rate limiting
  - stop-loss / take-profit
- Persist trades/positions to Postgres.

## Multi-DEX trading (important)

The trading bot uses a DEX aggregator abstraction:

- Collect quotes from enabled DEXes
- Compare by best output (and consider price impact)
- Execute on the best route

Supported DEXes:

- Jupiter
- Orca
- Meteora
- Raydium

Guidelines when touching DEX logic:

- Keep a **unified quote interface** across DEX clients.
- Make DEX enable/disable configurable.
- Ensure logs clearly state:
  - all quotes (for debugging)
  - selected best DEX + price impact
- Avoid hard-coding pool lists unless needed; prefer aggregator routing where possible.
