# Solana EDA Project Memory

## Quick Reference

### Project Type
Event-driven architecture (EDA) for Solana on-chain monitoring and automated trading.

### Tech Stack
- **Monorepo**: pnpm + Turborepo
- **Workers**: Node.js/TypeScript (burn-detector, liquidity-monitor, price-aggregator, trading-bot)
- **API**: NestJS (port 3000)
- **Frontend**: Next.js 14 with App Router (port 3001)
- **Database**: PostgreSQL with Prisma
- **Message Broker**: Redis pub/sub (migrate to Streams for mainnet)
- **Solana**: @solana/web3.js

### Local Development Services
- API: http://localhost:3000
- Frontend: http://localhost:3001
- Postgres: localhost:5432
- Redis: localhost:6379

## Key Learnings

See `/memory/ARCHITECTURE_ANALYSIS.md` for detailed mainnet readiness assessment.

### Critical Files for Reference
- `/docs/ARCHITECTURE.md` - Full system architecture
- `/docs/MULTI_DEX_IMPLEMENTATION.md` - DEX integration details
- `/docs/ARCHITECTURE_ANALYSIS_MAINNET_READINESS.md` - Mainnet readiness report

### Working with This Codebase

1. **Adding new event types**: Define in `/packages/events/src/index.ts`, then implement in worker
2. **DEX integration**: Add client to `/packages/solana-client/src/`, register in aggregator
3. **Database changes**: Edit schema, run `prisma migrate dev`, regenerate client
4. **Worker changes**: Workers subscribe to Redis channels, validate events with Zod, persist via repositories

### Gotchas
- ConnectionPool exists in `/packages/solana-client/src/batch-client.ts` but is NOT integrated into SolanaConnectionManager
- Redis pub/sub loses events if consumer is down - use Streams for durability
- No priority fee management - will fail on mainnet
- WebSocket reconnection has no backoff strategy
