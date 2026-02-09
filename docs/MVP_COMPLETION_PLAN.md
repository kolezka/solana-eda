# Solana EDA - MVP Completion Plan

**Analysis Date:** 2026-02-09
**Analyst:** SystemArchitect
**Purpose:** Concrete plan to finish MVP for production deployment

---

## 1. Current State Assessment

### 1.1 What Works (Implemented Features)

| Component | Status | Completeness | Notes |
|-----------|--------|--------------|-------|
| **Infrastructure** | ✅ Complete | 100% | Docker compose, PostgreSQL, Redis |
| **API (NestJS)** | ✅ Complete | 100% | All CRUD endpoints, WebSocket gateway |
| **Frontend (Next.js)** | ✅ Complete | 95% | All pages implemented, minor styling gaps |
| **Database Schema** | ✅ Complete | 100% | Prisma schema, all models defined |
| **Event System** | ✅ Complete | 100% | Zod schemas, Redis channels |
| **Solana Client** | ✅ Complete | 90% | Connection manager, rate limiting, batch client |
| **DEX Aggregator** | ✅ Complete | 100% | Jupiter, Orca, Meteora, Raydium support |
| **Workers** | ⚠️ Partial | 75% | See details below |

### 1.2 What Doesn't Work (Gaps)

#### Workers Status

| Worker | Status | Gap | Severity |
|--------|--------|-----|----------|
| `burn-detector` | ✅ Complete | None | - |
| `liquidity-monitor` | ✅ Complete | None | - |
| `price-aggregator` | ✅ Complete | None | - |
| `trading-bot` | ⚠️ Partial | No priority fee management | MEDIUM |
| `market-detector` | ⚠️ Partial | Not integrated into main workflow | LOW |

#### Core Issues

1. **Event Durability** - Redis pub/sub loses events on restart
2. **RPC Failover** - No connection pooling integrated
3. **Trading on Mainnet** - Missing priority fees (will fail on congested network)
4. **Testing** - No integration tests for critical paths
5. **Monitoring** - No alerting or production observability

### 1.3 Documentation Analysis

Based on `/docs/ARCHITECTURE.md`:

- **Phase 1 (Foundation)**: ✅ Complete
- **Phase 2 (Workers)**: ✅ Complete
- **Phase 3 (Trading Bot)**: ✅ Complete (multi-DEX integrated)
- **Phase 4 (Dashboard)**: ✅ Complete

**However**, the "Complete" status refers to feature implementation, not production readiness.

---

## 2. MVP Definition

### 2.1 MVP Criteria (Definition of Done)

The MVP is **complete** when the system can:

1. **Monitor Solana Events** (burns, liquidity changes, price updates) ✅
2. **Execute Trades** on at least one DEX with real funds ⚠️
3. **Track Positions** with P&L in the dashboard ✅
4. **Provide Real-time Updates** via WebSocket ✅
5. **Run for 24 Hours** without manual intervention ⚠️
6. **Handle Failures** gracefully (RPC restart, Redis reconnect) ❌

### 2.2 MVP Scope

#### In Scope (Essential)

- Event monitoring from devnet/mainnet-beta
- Single trading strategy: burn-and-buy
- One DEX for trading (Jupiter - most reliable)
- Basic dashboard with live feeds
- Manual trade triggering via API
- Position tracking and basic P&L

#### Out of Scope (Post-MVP)

- Multiple concurrent strategies
- Advanced arbitrage
- ML-based predictions
- Complex risk management
- Mobile app
- Social trading features

---

## 3. Gap Analysis & Prioritization

### 3.1 Critical Gaps (Blockers)

| ID | Gap | Impact | Est. Complexity | File References |
|----|-----|--------|-----------------|----------------|
| C1 | **Trading fails on mainnet** - No priority fees | Trades won't execute during congestion | Medium | `/packages/solana-client/src/dex-aggregator.ts` |
| C2 | **Event loss on restart** - Redis pub/sub is ephemeral | Missed trading opportunities | Low | `/packages/events/src/index.ts` |
| C3 | **No tests for trading flow** - Risk of breaking changes | Production bugs | Medium | All packages need tests |

### 3.2 High Priority Gaps

| ID | Gap | Impact | Est. Complexity | File References |
|----|-----|--------|-----------------|----------------|
| H1 | **RPC single point of failure** - No failover | Worker downtime | Low | `/packages/solana-client/src/connection.ts` |
| H2 | **WebSocket reconnect issues** - No backoff | Lost subscriptions | Low | `/packages/solana-client/src/connection.ts` |
| H3 | **No health monitoring** - Silent failures | Undetected downtime | Low | `/packages/monitoring/src/` (needs expansion) |

### 3.3 Medium Priority Gaps

| ID | Gap | Impact | Est. Complexity | File References |
|----|-----|--------|-----------------|----------------|
| M1 | **market-detector not integrated** - Worker exists but unused | Missed opportunities | Low | `/workers/market-detector/` |
| M2 | **No dead letter queue** - Failed events lost | Debugging difficulty | Medium | `/packages/events/src/` |
| M3 | **Settings page functional** - No actual settings persistence | Can't configure runtime | Low | `/apps/frontend/src/app/settings/page.tsx` |

### 3.4 Low Priority Gaps (Nice-to-Have)

| ID | Gap | Impact | Est. Complexity |
|----|-----|--------|-----------------|
| L1 | UI polish and animations | Better UX | Low |
| L2 | Advanced filtering on events page | Better usability | Low |
| L3 | Export functionality for data | Data analysis | Low |

---

## 4. Implementation Plan

### 4.1 Phase 1: Critical Fixes (1-2 days)

#### Task C1: Add Priority Fee Support

**Files to Modify:**
- `/packages/solana-client/src/priority-fee-manager.ts` (new)
- `/packages/solana-client/src/dex-aggregator.ts`
- `/packages/solana-client/src/jupiter-client.ts`

**Implementation Steps:**
1. Create `PriorityFeeManager` class
2. Add `getRecentPrioritizationFees()` call
3. Integrate into `executeBestSwap()`
4. Test on devnet with congestion simulation

**Code Pattern:**
```typescript
// packages/solana-client/src/priority-fee-manager.ts
export class PriorityFeeManager {
  async getPriorityFee(connection: Connection, accounts: PublicKey[]): Promise<number> {
    const fees = await connection.getRecentPrioritizationFees({ accounts });
    return Math.max(...fees.map(f => f.prioritizationFee)) + 1000; // Add buffer
  }
}
```

**Acceptance Criteria:**
- Trading bot executes on mainnet-beta during congestion
- Transactions confirm within 30 seconds
- Logs show priority fee used

---

#### Task C2: Add Event Replay Buffer

**Files to Modify:**
- `/packages/events/src/streams.ts` (new)
- `/workers/trading-bot/src/index.ts`

**Implementation Steps:**
1. Create Redis Streams wrapper alongside pub/sub
2. Implement consumer group for trading-bot
3. Add replay on startup (process last 5 minutes of events)
4. Maintain dual-write for compatibility

**Code Pattern:**
```typescript
// packages/events/src/streams.ts
export async function publishEvent(channel: string, event: AnyEvent) {
  // Dual write: pub/sub + stream
  await Promise.all([
    redis.publish(channel, JSON.stringify(event)),
    redis.xadd(`${channel}:stream`, '*', 'data', JSON.stringify(event))
  ]);
}
```

**Acceptance Criteria:**
- Events survive worker restart
- No duplicate processing
- Worker catches up on missed events after restart

---

#### Task C3: Add Integration Tests

**Files to Create:**
- `/workers/trading-bot/src/index.test.ts`
- `/packages/solana-client/src/dex-aggregator.test.ts`

**Implementation Steps:**
1. Test trading-bot event processing flow
2. Test DEX aggregator quote selection
3. Mock Jupiter API responses
4. Test slippage protection logic

**Acceptance Criteria:**
- 80%+ code coverage on critical paths
- Tests pass on CI
- Can detect breaking changes

---

### 4.2 Phase 2: High Priority Stability (2-3 days)

#### Task H1: Integrate Connection Pool

**Files to Modify:**
- `/packages/solana-client/src/connection.ts`
- Environment variables

**Implementation Steps:**
1. Add `SOLANA_RPC_URLS` env var (comma-separated)
2. Modify `SolanaConnectionManager` to use existing `ConnectionPool`
3. Add health checks for each RPC
4. Implement automatic failover

**Code Pattern:**
```typescript
// packages/solana-client/src/connection.ts
constructor(private config: ConnectionConfig) {
  const rpcUrls = config.rpcUrls || [config.rpcUrl];
  this.connectionPool = new ConnectionPool(rpcUrls);
}
```

**Acceptance Criteria:**
- RPC failure causes automatic switch to backup
- No worker downtime during single RPC failure
- Metrics show RPC health

---

#### Task H2: Fix WebSocket Reconnection

**Files to Modify:**
- `/packages/solana-client/src/connection.ts`

**Implementation Steps:**
1. Add exponential backoff to `connectWebSocket()`
2. Add jitter to avoid thundering herd
3. Re-subscribe to all subscriptions after reconnect
4. Add connection state monitoring

**Code Pattern:**
```typescript
private async reconnectWithBackoff(attempt = 0): Promise<void> {
  if (attempt >= 10) throw new Error('Max reconnection attempts');
  const delay = Math.min(1000 * Math.pow(2, attempt), 30000) + Math.random() * 1000;
  await this.delay(delay);
  await this.connectWebSocket();
  await this.resubscribeAll();
}
```

**Acceptance Criteria:**
- WebSocket disconnects auto-recover
- Subscriptions restored after reconnect
- No event loss during brief disconnects

---

#### Task H3: Add Health Monitoring

**Files to Create:**
- `/packages/monitoring/src/health-check.ts`
- `/packages/monitoring/src/alerts.ts`

**Implementation Steps:**
1. Create health check endpoints
2. Add Prometheus metrics
3. Configure alerts for critical failures
4. Add dashboard for monitoring

**Acceptance Criteria:**
- Health endpoint at `/health`
- Metrics exposed at `/metrics`
- Alerts fire on worker failure
- Dashboard shows system status

---

### 4.3 Phase 3: Medium Priority Features (3-4 days)

#### Task M1: Integrate market-detector

**Files to Modify:**
- `/workers/market-detector/src/index.ts`
- Package.json (include in build)

**Implementation Steps:**
1. Add market-detector to docker-compose
2. Add worker to supervisor/PM2 config
3. Connect events to trading-bot
4. Add dashboard page for discovered markets

**Acceptance Criteria:**
- market-detector runs continuously
- New markets appear in dashboard
- trading-bot can filter by discovered markets

---

#### Task M2: Add Dead Letter Queue

**Files to Create:**
- `/packages/events/src/dlq.ts`

**Implementation Steps:**
1. Create DLQ stream in Redis
2. Add error handler that moves failed events
3. Add DLQ replay endpoint in API
4. Add DLQ monitoring in dashboard

**Acceptance Criteria:**
- Failed events appear in DLQ
- Can replay events from DLQ
- DLQ size alerts when > 100

---

#### Task M3: Functional Settings Page

**Files to Modify:**
- `/apps/frontend/src/app/settings/page.tsx`
- `/apps/api/src/modules/settings/` (new)

**Implementation Steps:**
1. Create settings CRUD in API
2. Connect to TradeSettings repository
3. Add form validation
4. Test settings persistence

**Acceptance Criteria:**
- Settings persist to database
- Changes take effect within 30 seconds
- Validation prevents invalid values

---

### 4.4 Phase 4: Testing & Polish (2-3 days)

#### Task T1: End-to-End Testing

**Implementation Steps:**
1. Run full system locally for 24 hours
2. Simulate RPC failures
3. Simulate Redis restarts
4. Load test with high event volume
5. Fix discovered issues

#### Task T2: Documentation

**Files to Create:**
- `/docs/DEPLOYMENT.md`
- `/docs/OPERATIONS.md`
- `/docs/TROUBLESHOOTING.md`

**Implementation Steps:**
1. Document deployment process
2. Create operational runbooks
3. Document common issues and solutions
4. Add architecture diagrams

#### Task T3: Security Review

**Implementation Steps:**
1. Audit private key handling
2. Review API authentication
3. Check for SQL injection
4. Validate rate limiting
5. Add CORS restrictions

---

## 5. Cross-Coordination Notes

### 5.1 Dependencies Between Teams

| Task | Requires | Blocking |
|------|----------|----------|
| C1: Priority fees | None | No |
| C2: Event replay | None | No |
| C3: Tests | C1, C2 | Yes (tests need features) |
| H1: RPC failover | None | No |
| H2: WebSocket reconnect | None | No |
| H3: Health monitoring | H1, H2 | Yes (needs stable connections) |
| M1: market-detector | None | No |
| M2: DLQ | C2 | Yes (builds on streams) |
| M3: Settings page | None | No |

### 5.2 External Dependencies

| Dependency | Required By | Status | Notes |
|------------|-------------|--------|-------|
| Jupiter API | Trading bot | ✅ Available | Need API key for production |
| Solana RPC | All workers | ⚠️ Single point | Need multiple RPCs |
| Redis | Event system | ✅ Available | Need persistence config |
| PostgreSQL | Data storage | ✅ Available | Need backup strategy |

---

## 6. MVP Completion Checklist

### Infrastructure
- [ ] Docker compose includes all workers
- [ ] Environment variables documented
- [ ] Database migrations automated
- [ ] Redis persistence enabled
- [ ] Multiple RPC endpoints configured

### Workers
- [ ] burn-detector runs stable
- [ ] liquidity-monitor runs stable
- [ ] price-aggregator runs stable
- [ ] trading-bot executes trades with priority fees
- [ ] market-detector integrated (optional)

### API
- [ ] All endpoints functional
- [ ] WebSocket reconnection works
- [ ] Rate limiting configured
- [ ] CORS properly configured
- [ ] Health endpoint returns status

### Frontend
- [ ] All pages load without errors
- [ ] Real-time updates work
- [ ] Settings persist
- [ ] Mobile responsive
- [ ] Error handling present

### Testing
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] 24-hour stability test passed
- [ ] Failover scenarios tested

### Documentation
- [ ] Deployment guide written
- [ ] Operations runbook created
- [ ] API documentation updated
- [ ] Architecture diagram current

---

## 7. Estimated Timeline

| Phase | Tasks | Duration | Dependencies |
|-------|-------|----------|--------------|
| **Phase 1: Critical Fixes** | C1, C2, C3 | 2-3 days | None |
| **Phase 2: Stability** | H1, H2, H3 | 2-3 days | Phase 1 |
| **Phase 3: Features** | M1, M2, M3 | 3-4 days | Phase 2 |
| **Phase 4: Testing** | T1, T2, T3 | 2-3 days | Phase 3 |
| **Total** | | **9-13 days** | |

**Recommended Sprint Plan:**
- **Sprint 1 (Week 1-2)**: Phase 1 + Phase 2 (Critical + Stability)
- **Sprint 2 (Week 3)**: Phase 3 (Features)
- **Sprint 3 (Week 4)**: Phase 4 (Testing + Polish)

---

## 8. Success Metrics

### MVP Completion Criteria

The MVP is **complete** when:

1. ✅ System runs for 24 hours without manual intervention
2. ✅ Trading bot executes 10+ successful trades on devnet/mainnet-beta
3. ✅ All workers reconnect after RPC failure
4. ✅ Dashboard shows real-time data accurately
5. ✅ Zero data loss during worker restarts
6. ✅ API responds to all endpoints within 500ms
7. ✅ All critical tests pass
8. ✅ Deployment documented and reproducible

### Production Readiness Criteria

The system is **production-ready** when:

1. All MVP criteria met
2. Security audit passed
3. Monitoring and alerting configured
4. Backup and restore procedures tested
5. Disaster recovery plan documented
6. Team trained on operations

---

## 9. Risk Mitigation

### Known Risks

| Risk | Impact | Mitigation | Owner |
|------|--------|-----------|-------|
| Solana RPC downtime | High | Multiple RPCs with failover | DevOps |
| Trading losses during testing | Medium | Use devnet, limit position sizes | Trading |
| Event loss during deployment | Medium | Deploy during low activity, maintain streams | DevOps |
| Bugs in trading logic | High | Comprehensive testing, gradual rollout | All |
| Private key exposure | Critical | Use HSM/KMS, never log keys | Security |

---

## 10. Next Steps

### Immediate Actions (This Week)

1. **Start with Task C1** - Add priority fee support (highest impact)
2. **Set up testing** - Create test framework (enables faster iteration)
3. **Document current issues** - Track bugs discovered during testing

### This Sprint

1. Complete Phase 1 (Critical Fixes)
2. Begin Phase 2 (Stability)
3. Daily standups to track progress

### Looking Ahead

1. Plan post-MVP roadmap
2. Schedule security audit
3. Prepare mainnet deployment plan

---

## Appendix A: File Reference Summary

### Critical Files for MVP

```
/packages/solana-client/src/
├── connection.ts              # Add RPC pool integration
├── priority-fee-manager.ts    # NEW - Priority fee calculation
├── dex-aggregator.ts          # Add priority fee support
└── jupiter-client.ts          # Add priority fee to swaps

/packages/events/src/
├── streams.ts                 # NEW - Redis Streams wrapper
├── dlq.ts                     # NEW - Dead letter queue
└── index.ts                   # Add stream publishing

/workers/trading-bot/src/
├── index.ts                   # Add stream consumption
└── index.test.ts              # NEW - Integration tests

/packages/monitoring/src/
├── health-check.ts            # NEW - Health monitoring
└── alerts.ts                  # NEW - Alerting

/apps/api/src/modules/
└── settings/                  # NEW - Settings CRUD

/docs/
├── DEPLOYMENT.md              # NEW - Deployment guide
├── OPERATIONS.md              # NEW - Runbook
└── TROUBLESHOOTING.md         # NEW - Troubleshooting
```

---

**Document Status:** Ready for Team Review
**Last Updated:** 2026-02-09
**Next Review:** After Phase 1 completion
