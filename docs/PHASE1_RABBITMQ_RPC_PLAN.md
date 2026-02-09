# Phase 1 Unified Plan: RabbitMQ + RPC Pooling

**Date:** 2026-02-09
**Project:** Solana Event-Driven Architecture
**Version:** 1.0
**Status:** Ready for Implementation

---

## Executive Summary

Phase 1 focuses on two critical infrastructure improvements required for production deployment:

1. **RabbitMQ Integration** - Replace Redis pub/sub with durable message broker for guaranteed delivery
2. **RPC Connection Pooling** - Resolve rate limiting issues through intelligent connection management

**Duration:** 8 weeks (Sprint-based approach)
**Team:** 6 specialists (eda-architect, workers-engineer, api-dev, frontend-dev, defi-expert, scrum-master)

---

## Team Specialist Contributions Summary

| Specialist | Task | Status | Key Deliverables |
|------------|------|--------|------------------|
| **eda-architect** | #7 RabbitMQ migration design | ✅ Complete | Exchange topology, routing keys, migration phases |
| **workers-engineer** | #8 RPC pooling architecture | ⚠️ In Progress | Pool design awaiting finalization |
| **api-dev** | #9 API consumer patterns | ✅ Complete | Base consumer class, SSE endpoints |
| **frontend-dev** | #10 Frontend integration | ✅ Complete | WebSocket gateway patterns, SSE hooks |
| **defi-expert** | #11 RPC requirements | ✅ Complete | DEX-specific pooling strategy, 4-pool architecture |
| **scrum-master** | #12 Plan synthesis | ✅ Complete | This unified document |

---

## Current State Analysis

### Existing Architecture
```
┌─────────────────┐      ┌──────────────┐      ┌─────────────────┐
│   Workers       │─────▶│ Redis Pub/Sub│─────▶│  Trading Bot    │
│ (Producers)     │      │ (Ephemeral)   │      │  (Consumer)     │
└─────────────────┘      └──────────────┘      └─────────────────┘
        │                                                 │
        ▼                                                 ▼
┌─────────────────┐                              ┌─────────────────┐
│ Solana RPC      │◀─Single Connection─▶      │   PostgreSQL    │
│ (Rate Limited)  │                              │  (Persistence)  │
└─────────────────┘                              └─────────────────┘
```

### Critical Issues Identified

| Issue | Impact | Current | Phase 1 Fix |
|-------|--------|---------|-------------|
| **Event Loss** | HIGH | Redis pub/sub loses events | RabbitMQ persistence + DLQ |
| **RPC Rate Limits** | HIGH | Single connection per service | Multi-endpoint pooling |
| **No Event Replay** | MEDIUM | Pub/sub has no history | RabbitMQ queue retention |
| **No Failed Event Handling** | MEDIUM | Failed events lost | RabbitMQ dead letter queues |
| **RPC Single Point of Failure** | HIGH | Worker downtime on RPC fail | Pool failover |
| **WebSocket Gateway Not Working** | HIGH | Redis sub disabled | EventEmitter2 + SSE |

---

## Phase 1 Objectives

### Objective 1: RabbitMQ Integration

**Success Criteria:**
- [ ] All workers publish to RabbitMQ with publisher confirms
- [ ] All workers consume from RabbitMQ with manual ACK
- [ ] Dead letter queues functional and monitored
- [ ] Event replay capability working
- [ ] Zero events lost during worker restarts
- [ ] API delivers real-time events via SSE + WebSocket

**Migration Strategy:**
- Phase 1A: Dual-write (Redis + RabbitMQ) - 1 week
- Phase 1B: Dual-read (gradual consumer migration) - 1 week
- Phase 1C: Cutover (RabbitMQ only) - 1 week
- Phase 1D: Cleanup (remove Redis) - 1 week

### Objective 2: RPC Connection Pooling

**Success Criteria:**
- [ ] ConnectionPool integrated into SolanaConnectionManager
- [ ] 4-pool architecture implemented (Query, Submit, Jupiter API, WebSocket)
- [ ] Multiple RPC endpoints supported with load balancing
- [ ] Health checks with automatic failover
- [ ] Per-endpoint rate limiting enforced
- [ ] No rate limit issues under normal load

**DeFi-Specific Requirements:**
- Separate submit pool for transaction criticality
- Jupiter API HTTP pool (doesn't use Solana RPC)
- WebSocket pool for subscription stability
- Priority RPC endpoints for high-value operations

---

## Architecture Design

### RabbitMQ Topology

```
┌──────────────────────────────────────────────────────────────────┐
│                         RabbitMQ Broker                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Exchange: solana.events (topic)                           │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                    │
│         ┌──────────────────────┼──────────────────────┐          │
│         ▼                      ▼                      ▼          │
│  ┌────────────┐        ┌────────────┐        ┌────────────┐  │
│  │q.burn.events│        │q.trade.events│       │q.price.events│ │
│  │(durable)   │        │(durable)   │        │(durable)   │  │
│  │+ DLQ       │        │+ DLQ       │        │+ DLQ       │  │
│  └────────────┘        └────────────┘        └────────────┘  │
│                                                                  │
│  ┌────────────┐        ┌────────────┐        ┌────────────┐  │
│  │q.liquidity │        │q.positions │        │q.workers   │  │
│  │(durable)   │        │(durable)   │        │(durable)   │  │
│  │+ DLQ       │        │+ DLQ       │        │+ DLQ       │  │
│  └────────────┘        └────────────┘        └────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### RPC Connection Pool Architecture

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
│  │ 3 endpoints  │  │ 2 endpoints  │  │ 1 endpoint   │        │
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

### API Real-Time Delivery Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│ RabbitMQ        │─────▶│ API Consumers    │─────▶│ EventEmitter2   │
│ Queues          │      │ (BaseConsumer)   │      │ (In-Memory Bus) │
└─────────────────┘      └──────────────────┘      └─────────────────┘
                                                               │
                                    ┌──────────────────────────┼────────────┐
                                    ▼                          ▼            ▼
                            ┌──────────────┐          ┌──────────┐  ┌───────┐
                            │ EventsGateway│          │  SSE     │  │ REST  │
                            │ (WebSocket)  │          │Endpoints │  │ API   │
                            └──────────────┘          └──────────┘  └───────┘
                                    │                          │            │
                                    └──────────────────────────┼────────────┘
                                                               ▼
                                                        ┌─────────────────┐
                                                        │   Frontend      │
                                                        │ (Browser/Client)│
                                                        └─────────────────┘
```

---

## Sprint-by-Sprint Implementation Plan

### Sprint 1 (Week 1-2): RabbitMQ Infrastructure

**Owner:** eda-architect (lead), api-dev (support)

**Goals:**
- Create RabbitMQ client library package
- Establish exchange/queue topology
- Implement base consumer class
- Add health check endpoints

**Tasks:**

| Day | Task | Owner | Deliverables |
|-----|------|-------|--------------|
| 1-2 | Create `packages/rabbitmq/` structure | eda-architect | Module scaffold, TypeScript config |
| 3-4 | Implement connection management | eda-architect | Connection class with reconnect |
| 5-6 | Implement producer with confirm mode | eda-architect | Publisher class |
| 7-8 | Implement consumer with ACK/NACK | eda-architect | Consumer base class |
| 9-10 | Implement topology setup | eda-architect | Exchange/queue declaration |
| 10 | Implement dead letter queue handler | eda-architect | DLQ routing |

**DoD:**
- [ ] RabbitMQ package compiles and tests pass
- [ ] Can connect to local RabbitMQ via Docker
- [ ] Topology creates exchanges, queues, bindings
- [ ] Publisher sends messages with confirm
- [ ] Consumer receives and ACKs messages
- [ ] Failed messages route to DLQ

---

### Sprint 2 (Week 3-4): Event Consumers

**Owner:** api-dev (lead), eda-architect (support)

**Goals:**
- Implement all 6 event consumers
- Add EventEmitter2 integration
- Create SSE endpoints
- Enable WebSocket gateway

**Tasks:**

| Day | Task | Owner | Deliverables |
|-----|------|-------|--------------|
| 11-12 | Create BurnEventConsumer | api-dev | Burns persisted to DB |
| 13-14 | Create LiquidityEventConsumer | api-dev | Liquidity updates persisted |
| 15-16 | Create TradeEventConsumer | api-dev | Trades with position updates |
| 17-18 | Create PositionEventConsumer | api-dev | Position lifecycle managed |
| 19 | Create PriceEventConsumer | api-dev | Prices persisted |
| 20 | Create WorkerStatusConsumer | api-dev | Worker status tracked |
| 21-22 | Add EventEmitter2 integration | api-dev | In-memory event bus |
| 23-24 | Implement SSE endpoints | api-dev | `/events/stream` functional |
| 25 | Enable EventsGateway | api-dev | WebSocket receives events |
| 26 | Integration testing | api-dev | All consumers working |

**DoD:**
- [ ] All 6 consumers process events correctly
- [ ] Events persist to PostgreSQL
- [ ] SSE endpoints deliver events
- [ ] WebSocket gateway broadcasts events
- [ ] No event loss in normal operation
- [ ] Failed events route to DLQ

---

### Sprint 3 (Week 5-6): Worker Migration

**Owner:** workers-engineer (lead), eda-architect (support)

**Goals:**
- Implement dual-write (Redis + RabbitMQ)
- Migrate workers incrementally
- Validate message parity
- Prepare for cutover

**Tasks:**

| Day | Task | Owner | Deliverables |
|-----|------|-------|--------------|
| 27-28 | Add feature flags for RabbitMQ | workers-engineer | Configurable publishing |
| 29-30 | Implement dual-write in burn-detector | workers-engineer | Publishes to both |
| 31-32 | Implement dual-write in liquidity-monitor | workers-engineer | Publishes to both |
| 33-34 | Implement dual-write in price-aggregator | workers-engineer | Publishes to both |
| 35-36 | Implement dual-write in trading-bot | workers-engineer | Publishes to both |
| 37-38 | Create message parity validator | workers-engineer | Compares Redis vs RabbitMQ |
| 39-40 | Validation period | workers-engineer | Parity confirmed |
| 41-42 | Prepare cutover runbook | scrum-master | Step-by-step guide |

**DoD:**
- [ ] All workers publish to both Redis and RabbitMQ
- [ ] Message parity validator shows 100% match
- [ ] Feature flags allow independent control
- [ ] No performance degradation from dual-write
- [ ] Cutover runbook complete and reviewed

---

### Sprint 4 (Week 7-8): RPC Pooling & Final Integration

**Owner:** workers-engineer (lead), defi-expert (support)

**Goals:**
- Implement 4-pool RPC architecture
- Add health checks and failover
- Complete RabbitMQ cutover
- Final testing and validation

**Tasks:**

| Day | Task | Owner | Deliverables |
|-----|------|-------|--------------|
| 43-44 | Integrate ConnectionPool into SolanaConnectionManager | workers-engineer | Pool-based connections |
| 45-46 | Implement Query Pool | workers-engineer | Read operations pooled |
| 47-48 | Implement Submit Pool | workers-engineer | Critical TX path isolated |
| 49-50 | Implement Jupiter API Pool | workers-engineer | HTTP pooling for DEX |
| 51-52 | Implement WebSocket Pool | workers-engineer | Stable subscriptions |
| 53-54 | Add health checks and failover | workers-engineer | Auto-recovery working |
| 55-56 | RabbitMQ cutover (consumers first) | eda-architect | All consumers on RabbitMQ |
| 57-58 | RabbitMQ cutover (producers) | workers-engineer | All workers on RabbitMQ |
| 59-60 | Integration testing | All | End-to-end validation |

**DoD:**
- [ ] All 4 pools operational
- [ ] RPC failover working without downtime
- [ ] No rate limit issues under load
- [ ] All workers consume from RabbitMQ only
- [ ] Redis pub/sub deprecated
- [ ] System stable for 24 hours

---

## Resource Allocation

### Team Member Responsibilities

| Specialist | Sprint 1 | Sprint 2 | Sprint 3 | Sprint 4 |
|------------|----------|----------|----------|----------|
| **eda-architect** | Lead | Support | Support | Support |
| **workers-engineer** | Support | Support | Lead | Lead |
| **api-dev** | Support | Lead | Support | Support |
| **frontend-dev** | Available | Available | Available | Available |
| **defi-expert** | Consult | Consult | Consult | Support |
| **scrum-master** | Coordination | Coordination | Coordination | Coordination |

### Task Dependencies

**Critical Path:**
```
Sprint 1 (RabbitMQ Infrastructure)
    │
    ▼
Sprint 2 (Event Consumers)
    │
    ├──────────────┐
    ▼              ▼
Sprint 3        Sprint 4
(Worker         (RPC Pooling)
 Migration)      │
    │             │
    └──────┬──────┘
           ▼
    Final Integration
```

---

## Configuration

### Environment Variables

```bash
# RabbitMQ Configuration
RABBITMQ_URL=amqp://user:password@localhost:5672
RABBITMQ_EXCHANGE=solana.events
RABBITMQ_EXCHANGE_TYPE=topic
RABBITMQ_PREFETCH_COUNT=10
RABBITMQ_RECONNECT_DELAY=5000

# RabbitMQ Feature Flags (Migration)
RABBITMQ_ENABLED=false
RABBITMQ_DUAL_WRITE=false
RABBITMQ_DUAL_READ=false

# RPC Pooling Configuration
SOLANA_RPC_URLS=https://rpc1.example.com,https://rpc2.example.com,https://rpc3.example.com
SOLANA_QUERY_POOL_SIZE=10
SOLANA_SUBMIT_POOL_SIZE=5
SOLANA_RPC_HEALTH_CHECK_INTERVAL=30000
SOLANA_RPC_MAX_SUBSCRIPTIONS_PER_CONNECTION=1000

# Jupiter API Pool
JUPITER_API_URL=https://quote-api.jup.ag/v6
JUPITER_POOL_SIZE=20
JUPITER_RATE_LIMIT=100

# Existing (Keep)
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/solana_eda
```

### Docker Compose Updates

```yaml
services:
  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - "5672:5672"
      - "15672:15672"
    environment:
      RABBITMQ_DEFAULT_USER: solana
      RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD:-changeme}
    volumes:
      - rabbitmq-data:/var/lib/rabbitmq

volumes:
  rabbitmq-data:
```

---

## File Changes Summary

### New Packages

```
packages/rabbitmq/
├── src/
│   ├── index.ts              # Main exports
│   ├── connection.ts         # Connection management
│   ├── producer.ts           # Message publisher
│   ├── consumer.ts           # Message consumer
│   ├── topology.ts           # Exchange/queue setup
│   ├── dlq.ts                # Dead letter queue
│   ├── retry.ts              # Retry policies
│   └── types.ts              # TypeScript interfaces
├── package.json
└── tsconfig.json
```

### Modified Files

```
packages/solana-client/src/
├── connection.ts              # Integrate ConnectionPool
├── connection-pool.ts        # NEW - Pool manager
├── health-monitor.ts         # NEW - RPC health monitoring
└── batch-client.ts           # Expose ConnectionPool

packages/events/src/
├── index.ts                  # Add RabbitMQ event schemas
└── deduplication.ts          # Enhance for RabbitMQ

workers/*/src/
└── index.ts                  # Add RabbitMQ publishing

apps/api/src/
├── rabbitmq/                 # NEW - RabbitMQ module
│   ├── rabbitmq.module.ts
│   ├── rabbitmq.service.ts
│   └── rabbitmq.controller.ts
├── consumers/                # NEW - Event consumers
│   ├── base/
│   │   └── base-event.consumer.ts
│   ├── burn-event.consumer.ts
│   ├── liquidity-event.consumer.ts
│   ├── trade-event.consumer.ts
│   ├── position-event.consumer.ts
│   ├── price-event.consumer.ts
│   └── worker-status.consumer.ts
└── modules/events/
    ├── events.gateway.ts     # Use EventEmitter2
    └── events-sse.controller.ts  # NEW - SSE endpoints

apps/frontend/src/
└── hooks/
    └── use-sse.ts             # NEW - SSE hook
```

---

## Risk Assessment

### High-Risk Items

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Message loss during migration** | HIGH | MEDIUM | Dual-write phase, parity validation |
| **RPC pooling complexity** | MEDIUM | MEDIUM | Incremental implementation, extensive testing |
| **Performance regression** | MEDIUM | LOW | Load testing before/after comparison |
| **Extended timeline** | MEDIUM | MEDIUM | Sprint structure with clear checkpoints |
| **RabbitMQ operational overhead** | LOW | HIGH | Docker Compose for local, managed for prod |

### Mitigation Strategies

1. **Dual-Write Phase** - Maintain both Redis and RabbitMQ
2. **Incremental Migration** - One worker at a time
3. **Rollback Plan** - Revert to Redis within 5 minutes
4. **Performance Testing** - Benchmark at each sprint
5. **Monitoring** - Extensive metrics from day one

---

## Success Criteria

### Phase 1 Complete When:

**RabbitMQ:**
- [ ] All workers publish to RabbitMQ
- [ ] All workers consume from RabbitMQ
- [ ] Dead letter queues functional
- [ ] Event replay working
- [ ] Zero events lost during restarts
- [ ] API SSE endpoints operational

**RPC Pooling:**
- [ ] 4-pool architecture implemented
- [ ] Health checks operational
- [ ] Automatic failover working
- [ ] No rate limit issues
- [ ] WebSocket subscriptions stable

**System:**
- [ ] System stable for 24 hours
- [ ] All integration tests passing
- [ ] Documentation updated
- [ ] Deployment runbook created

---

## Definition of Done

For each task to be considered "Done":

- [ ] Code written and follows conventions
- [ ] Peer-reviewed by another specialist
- [ ] Tests written and passing
- [ ] Documentation updated
- [ ] Integrated to main branch
- [ ] Works in local environment
- [ ] Tested on devnet/mainnet-beta

---

## Next Steps

### Immediate (Sprint 1 Start)
1. Begin RabbitMQ package implementation
2. Set up local RabbitMQ via Docker Compose
3. Create feature flag infrastructure

### This Sprint (Week 1-2)
1. Complete RabbitMQ infrastructure
2. Implement base consumer pattern
3. Add health check endpoints

### Looking Ahead (Sprints 2-4)
1. Implement all event consumers
2. Migrate workers to RabbitMQ
3. Implement RPC pooling
4. Final integration and testing

---

**Document Status:** Ready for Team Review and Implementation
**Created:** 2026-02-09
**Scrum Master:** scrum-master
**Next Action:** Team approval and Sprint 1 kickoff
