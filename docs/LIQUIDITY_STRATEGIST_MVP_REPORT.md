# LiquidityStrategist MVP Completion Report

**Analyst:** LiquidityStrategist (Analityk DeFi)
**Date:** February 9, 2026
**Focus:** Trading strategy implementation gaps and liquidity arbitrage opportunities for MVP

---

## Executive Summary

From a liquidity and trading strategy perspective, the Solana EDA system has **solid foundational architecture** but requires **critical enhancements** to be production-ready for real trading on mainnet. The core gap is that the current trading bot lacks the sophistication needed to compete in Solana's high-frequency MEV environment.

**Key Finding:** The bot can execute basic trades but will lose opportunities to more sophisticated competitors due to missing priority fee management, lack of arbitrage strategies, and no real-time market discovery.

---

## 1. Current State Assessment

### 1.1 What Works (Trading & Liquidity Features)

| Component | Status | Completeness | Production Ready? |
|-----------|--------|--------------|-------------------|
| **DEX Aggregator** | ✅ Complete | 100% | ⚠️ No - missing priority fees |
| **Multi-DEX Support** | ✅ Complete | 100% | ⚠️ No - uses Jupiter routing only |
| **Burn Detection Strategy** | ✅ Complete | 100% | ✅ Yes - simple but functional |
| **Position Management** | ✅ Complete | 100% | ✅ Yes - SL/TP implemented |
| **Trade Execution** | ⚠️ Partial | 70% | ❌ No - missing priority fees |
| **Arbitrage Detection** | ❌ Missing | 0% | ❌ No |
| **Market Discovery** | ⚠️ Partial | 30% | ❌ No - worker exists but unused |

### 1.2 Current Trading Strategies

**Implemented:**
1. **Burn-and-Buy Strategy** (`/workers/trading-bot/src/index.ts`)
   - Detects token burn events via Redis
   - Executes buy when burn amount exceeds threshold
   - Implements stop-loss and take-profit
   - **Status:** Functional but basic

**Not Implemented (from research):**
1. **Cross-DEX Arbitrage** - No price discrepancy detection between DEXes
2. **Triangular Arbitrage** - No multi-hop cycle detection
3. **CLMM Tick Arbitrage** - No Orca/Meteora concentrated liquidity exploitation
4. **Pump.fun Launch Arbitrage** - No new token discovery and early entry
5. **Phoenix Order Flow Front-Running** - No order book monitoring

### 1.3 Multi-DEX Implementation Reality

**Claim vs. Reality:**
- **Documentation claims:** Direct SDK integration with Orca, Meteora, Raydium
- **Actual implementation:** Uses Jupiter API as routing layer for all DEXes
- **Impact:** Limited to Jupiter's routing optimization, missing opportunities for:
  - Direct Orca CLMM pool access
  - Meteora DLMM-specific strategies
  - Raydium Whirlpool arbitrage
  - Custom routing beyond Jupiter's algorithm

---

## 2. MVP Definition (Liquidity & Trading Focus)

### 2.1 MVP Trading Criteria

The MVP is **complete** when the system can:

1. **Execute trades reliably on mainnet** - with priority fees ⚠️
2. **Detect and exploit simple arbitrage** - at least one strategy ❌
3. **Monitor liquidity in real-time** - pool state changes ✅
4. **Track positions with P&L** - database persistence ✅
5. **Handle slippage appropriately** - dynamic calculation ⚠️
6. **Run for 24 hours without intervention** - stability ⚠️

### 2.2 MVP Scope (Essential Trading Features)

#### In Scope

- **One working arbitrage strategy** (cross-DEX or triangular)
- **Priority fee management** (critical for mainnet)
- **Real-time price monitoring** (from existing price-aggregator)
- **Basic slippage protection** (dynamic based on volatility)
- **Position limits and risk management** (existing, needs refinement)

#### Out of Scope (Post-MVP)

- Multiple concurrent arbitrage strategies
- ML-based price prediction
- Complex multi-hop arbitrage
- MEV protection (beyond priority fees)
- Advanced liquidity provision strategies

---

## 3. Gap Analysis & Prioritization

### 3.1 Critical Gaps (Blockers for Mainnet Trading)

| ID | Gap | Why Critical | Est. Complexity | File References |
|----|-----|-------------|-----------------|----------------|
| **L-C1** | **No priority fee management** | Trades will fail during congestion | Medium | `/packages/solana-client/src/dex-aggregator.ts:134-163` |
| **L-C2** | **No arbitrage detection logic** | Missing primary profit opportunity | High | `/workers/trading-bot/src/index.ts` (needs new strategy) |
| **L-C3** | **Static slippage settings** | Will overpay on low-vol, fail on high-vol | Low | `/workers/trading-bot/src/index.ts:197, 212, 348` |

### 3.2 High Priority Gaps (Competitive Disadvantages)

| ID | Gap | Impact | Est. Complexity | File References |
|----|-----|--------|-----------------|----------------|
| **L-H1** | **No cross-DEX price comparison** | Can't exploit DEX price discrepancies | Medium | `/packages/solana-client/src/dex-aggregator.ts` (has infrastructure, no arb logic) |
| **L-H2** | **No triangular arbitrage** | Missing 3-hop profit opportunities | High | New worker or strategy needed |
| **L-H3** | **market-detector not integrated** | Missing new market/opportunity discovery | Low | `/workers/market-detector/src/index.ts` |

### 3.3 Medium Priority Gaps (Optimization)

| ID | Gap | Impact | Est. Complexity | File References |
|----|-----|--------|-----------------|----------------|
| **L-M1** | **No DEX-specific routing** | Limited to Jupiter's optimization | Medium | `/packages/solana-client/src/dex-aggregator.ts` |
| **L-M2** | **No liquidity depth analysis** | Can't assess trade size impact | Low | `/packages/solana-client/src/dex-aggregator.ts` |
| **L-M3** | **No price impact estimation** | Poor execution on large trades | Low | `/packages/solana-client/src/dex-aggregator.ts` |

---

## 4. Implementation Plan

### 4.1 Phase 1: Critical Trading Fixes (3-5 days)

#### Task L-C1: Implement Priority Fee Management

**Priority:** HIGHEST - Required for mainnet trading

**Files to Create:**
- `/packages/solana-client/src/priority-fee-manager.ts` (new)

**Files to Modify:**
- `/packages/solana-client/src/dex-aggregator.ts`
- `/packages/solana-client/src/jupiter-client.ts`

**Implementation Steps:**

1. **Create PriorityFeeManager class:**
```typescript
export class PriorityFeeManager {
  async getPriorityFee(
    connection: Connection,
    accounts?: PublicKey[]
  ): Promise<number> {
    // Get recent prioritization fees
    const fees = await connection.getRecentPrioritizationFees({ accounts });

    // Calculate median fee from recent transactions
    const validFees = fees.filter(f => f.prioritizationFee > 0);
    if (validFees.length === 0) return 1000; // Default minimum

    const sortedFees = validFees.map(f => f.prioritizationFee).sort((a, b) => a - b);
    const medianFee = sortedFees[Math.floor(sortedFees.length / 2)];

    // Add 20% buffer for priority
    return Math.ceil(medianFee * 1.2);
  }

  async setComputeUnitPrice(
    transaction: Transaction,
    microLamports: number
  ): Transaction {
    // Add ComputeBudgetInstruction for setComputeUnitPrice
    const COMPUTE_BUDGET_IX = new TransactionInstruction({
      programId: new PublicKey('ComputeBudget111111111111111111111111111111'),
      data: Buffer.from([3, ...this.toBigIntLE(BigInt(microLamports))]),
      keys: [],
    });
    transaction.add(COMPUTE_BUDGET_IX);
    return transaction;
  }

  async setComputeUnitLimit(
    transaction: Transaction,
    units: number
  ): Transaction {
    // Add ComputeBudgetInstruction for setComputeUnitLimit
    const COMPUTE_BUDGET_IX = new TransactionInstruction({
      programId: new PublicKey('ComputeBudget111111111111111111111111111111'),
      data: Buffer.from([2, ...this.toBigIntLE(BigInt(units))]),
      keys: [],
    });
    transaction.add(COMPUTE_BUDGET_IX);
    return transaction;
  }

  private toBigIntLE(value: bigint): Uint8Array {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    view.setBigUint64(0, value, true); // Little-endian
    return new Uint8Array(buffer);
  }
}
```

2. **Integrate into DEXAggregator:**
```typescript
// In dex-aggregator.ts
async executeBestSwap(
  bestQuote: BestQuote,
  maxSlippageBps: number = 50
): Promise<SwapResult> {
  const client = this.clients.get(bestQuote.dex);
  if (!client) throw new Error(`DEX ${bestQuote.dex} not found`);

  // Calculate priority fee
  const priorityFeeManager = new PriorityFeeManager();
  const priorityFee = await priorityFeeManager.getPriorityFee(
    this.connection,
    bestQuote.accountsInvolved
  );

  // Execute swap with priority fee
  const result = await client.executeSwap(bestQuote, maxSlippageBps, {
    priorityFee,
    computeUnits: 200000, // Standard DEX swap
  });

  return result;
}
```

3. **Update JupiterClient:**
```typescript
// In jupiter-client.ts
async executeSwap(
  quote: QuoteResponse,
  maxSlippageBps: number,
  options?: { priorityFee?: number; computeUnits?: number }
): Promise<SwapResult> {
  const { swapTransaction, setupLegacyTransaction } = await this.jupiterApi.exchange({
    setup: swapRequest.quoteResponse,
    userPublicKey: this.wallet.publicKey.toBase58(),
  });

  let transaction = VersionedTransaction.deserialize(
    Buffer.from(swapTransaction, 'base64')
  );

  // Add priority fee if provided
  if (options?.priorityFee) {
    const feeManager = new PriorityFeeManager();
    transaction = await feeManager.setComputeUnitPrice(
      transaction as any,
      options.priorityFee
    );
    if (options.computeUnits) {
      transaction = await feeManager.setComputeUnitLimit(
        transaction as any,
        options.computeUnits
      );
    }
  }

  // Sign and send
  transaction.sign([this.wallet]);
  const signature = await this.connection.sendTransaction(transaction);

  return {
    signature,
    dex: 'jupiter',
    actualSlippage: 0, // Calculate from confirmation
  };
}
```

**Acceptance Criteria:**
- Trading bot executes on mainnet-beta during congestion
- Transactions confirm within 30 seconds
- Logs show priority fee used
- No failed transactions due to low fees

**Dependencies:** None

---

#### Task L-C2: Implement Cross-DEX Arbitrage Strategy

**Priority:** HIGH - Primary profit opportunity

**Files to Create:**
- `/workers/arbitrage-bot/src/index.ts` (new worker)
- `/workers/arbitrage-bot/package.json`

**Implementation Steps:**

1. **Create arbitrage-bot worker:**
```typescript
// /workers/arbitrage-bot/src/index.ts
import Redis from 'ioredis';
import { SolanaConnectionManager, DEXAggregator } from '@solana-eda/solana-client';

class ArbitrageBot {
  private dexAggregator: DEXAggregator;
  private redis: Redis;
  private monitoredPairs: Map<string, boolean> = new Map();
  private minProfitBps = 50; // 0.5% minimum profit
  private tradeSize = 1000000; // 1 USDC

  async start() {
    console.log('[ArbitrageBot] Starting arbitrage bot...');

    // Monitor top trading pairs
    const pairs = [
      { input: 'USDC', output: 'SOL' },
      { input: 'SOL', output: 'USDC' },
      { input: 'USDC', output: 'RAY' },
      { input: 'USDC', output: 'JUP' },
      // Add more pairs
    ];

    for (const pair of pairs) {
      this.monitoredPairs.set(`${pair.input}-${pair.output}`, true);
    }

    // Run arbitrage check every 5 seconds
    setInterval(async () => {
      await this.checkArbitrageOpportunities();
    }, 5000);
  }

  private async checkArbitrageOpportunities() {
    for (const [pairKey] of this.monitoredPairs) {
      const [input, output] = pairKey.split('-');

      try {
        // Get all quotes from different DEXes
        const allQuotes = await this.dexAggregator.getAllQuotes(
          new PublicKey(this.getMintAddress(input)),
          new PublicKey(this.getMintAddress(output)),
          BigInt(this.tradeSize)
        );

        // Find price differences
        if (allQuotes.length >= 2) {
          const bestBuy = allQuotes.reduce((best, q) =>
            q.inAmount < best.inAmount ? q : best
          );
          const bestSell = allQuotes.reduce((best, q) =>
            q.outAmount > best.outAmount ? q : best
          );

          // Calculate profit
          const buyPrice = Number(bestBuy.inAmount) / Number(bestBuy.outAmount);
          const sellPrice = Number(bestSell.outAmount) / Number(bestSell.inAmount);
          const profitBps = ((sellPrice - buyPrice) / buyPrice) * 10000;

          if (profitBps > this.minProfitBps && bestBuy.dex !== bestSell.dex) {
            console.log(`[ArbitrageBot] Opportunity found: ${pairKey}`);
            console.log(`[ArbitrageBot]   Buy on ${bestBuy.dex}: ${buyPrice}`);
            console.log(`[ArbitrageBot]   Sell on ${bestSell.dex}: ${sellPrice}`);
            console.log(`[ArbitrageBot]   Profit: ${profitBps.toFixed(2)} bps`);

            // Execute arbitrage
            await this.executeArbitrage(bestBuy, bestSell, profitBps);
          }
        }
      } catch (error) {
        console.error(`[ArbitrageBot] Error checking ${pairKey}:`, error);
      }
    }
  }

  private async executeArbitrage(
    buyQuote: BestQuote,
    sellQuote: BestQuote,
    profitBps: number
  ) {
    // TODO: Implement atomic execution using Jito bundle
    // For MVP: Execute sequentially with slippage protection
    console.log(`[ArbitrageBot] Executing arbitrage...`);

    // Emit arbitrage event
    const event = {
      type: 'ARBITRAGE_OPPORTUNITY',
      timestamp: new Date().toISOString(),
      data: {
        pair: `${buyQuote.inputMint}-${buyQuote.outputMint}`,
        buyDex: buyQuote.dex,
        sellDex: sellQuote.dex,
        profitBps,
        buyPrice: buyQuote.price,
        sellPrice: sellQuote.price,
      },
    };

    await this.redis.publish('arbitrage:opportunities', JSON.stringify(event));
  }

  private getMintAddress(symbol: string): string {
    const addresses: Record<string, string> = {
      'SOL': 'So11111111111111111111111111111112',
      'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      'RAY': '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
      'JUP': 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
    };
    return addresses[symbol] || symbol;
  }
}

// Start worker
const bot = new ArbitrageBot();
bot.start().catch(console.error);
```

2. **Add to docker-compose.yml:**
```yaml
services:
  arbitrage-bot:
    build:
      context: .
      dockerfile: workers/arbitrage-bot/Dockerfile
    environment:
      - SOLANA_RPC_URL=${SOLANA_RPC_URL}
      - REDIS_URL=redis://redis:6379
      - TRADING_PRIVATE_KEY=${TRADING_PRIVATE_KEY}
    depends_on:
      - redis
```

**Acceptance Criteria:**
- Arbitrage bot detects price discrepancies between DEXes
- Logs show opportunities with profit calculations
- Events published to Redis channel
- (Future) Atomic execution implemented

**Dependencies:** None (can run parallel to existing workers)

---

#### Task L-C3: Implement Dynamic Slippage Calculation

**Priority:** MEDIUM - Better execution, less failed trades

**Files to Modify:**
- `/packages/solana-client/src/slippage-calculator.ts` (new)
- `/workers/trading-bot/src/index.ts`

**Implementation Steps:**

1. **Create SlippageCalculator:**
```typescript
export class SlippageCalculator {
  /**
   * Calculate dynamic slippage based on:
   * - Recent price volatility
   * - Trade size vs pool liquidity
   * - Current network congestion
   */
  async calculateSlippage(
    tokenMint: PublicKey,
    tradeSize: bigint,
    poolLiquidity: bigint,
    recentPrices: number[]
  ): Promise<number> {
    // Calculate price volatility (standard deviation)
    const volatility = this.calculateVolatility(recentPrices);

    // Base slippage from volatility
    const volatilitySlippage = volatility * 100; // Convert to bps

    // Size impact (trade size / pool liquidity)
    const sizeImpact = Number(tradeSize) / Number(poolLiquidity);
    const sizeSlippage = sizeImpact * 10000; // Convert to bps

    // Combine with weights
    const dynamicSlippage = Math.max(
      10, // Minimum 0.1%
      Math.min(
        1000, // Maximum 10%
        (volatilitySlippage * 0.6) + (sizeSlippage * 0.4)
      )
    );

    return Math.ceil(dynamicSlippage);
  }

  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0.01; // Default 1%

    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((sum, price) =>
      sum + Math.pow(price - mean, 2), 0
    ) / prices.length;

    return Math.sqrt(variance) / mean; // Coefficient of variation
  }
}
```

**Acceptance Criteria:**
- Slippage adjusts based on market conditions
- High volatility = higher slippage tolerance
- Large trades = higher slippage tolerance
- Configurable min/max bounds

**Dependencies:** Requires historical price data (from price-aggregator)

---

### 4.2 Phase 2: High Priority Features (5-7 days)

#### Task L-H1: Enhanced DEX Quote Comparison

**Files to Modify:**
- `/packages/solana-client/src/dex-aggregator.ts`

**Implementation:**
```typescript
// Add to DEXAggregator class
async getBestQuoteWithAnalysis(
  inputMint: PublicKey,
  outputMint: PublicKey,
  amount: bigint
): Promise<BestQuote & Analysis> {
  const allQuotes = await this.getAllQuotes(inputMint, outputMint, amount);

  // Analyze each quote
  const analyzedQuotes = allQuotes.map(quote => ({
    ...quote,
    score: this.calculateQuoteScore(quote),
    confidence: this.calculateConfidence(quote),
  }));

  // Select best by score (not just price)
  return analyzedQuotes.reduce((best, q) =>
    q.score > best.score ? q : best
  );
}

private calculateQuoteScore(quote: BestQuote): number {
  let score = 0;

  // Price (40% weight) - more output is better
  score += (Number(quote.outAmount) / Number(quote.inAmount)) * 40;

  // Price impact (30% weight) - lower is better
  score += (1 - quote.priceImpactPct) * 30;

  // DEX reliability (20% weight)
  const dexReliability: Record<string, number> = {
    jupiter: 0.95,
    orca: 0.90,
    raydium: 0.85,
    meteora: 0.80,
  };
  score += (dexReliability[quote.dex] || 0.5) * 20;

  // Liquidity depth (10% weight)
  score += Math.min(1, Number(quote.liquidity) / 100000) * 10;

  return score;
}
```

#### Task L-H2: Triangular Arbitrage Detection

**Files to Create:**
- `/packages/solana-client/src/triangular-arb.ts` (new)

**Implementation:**
```typescript
export class TriangularArbitrage {
  /**
   * Detect triangular arbitrage opportunities
   * Example: SOL -> USDC -> RAY -> SOL
   */
  async detectOpportunities(
    baseToken: string,
    connection: Connection,
    dexAggregator: DEXAggregator
  ): Promise<TriangularOpportunity[]> {
    const opportunities: TriangularOpportunity[] = [];

    // Common triangular paths on Solana
    const paths = [
      ['SOL', 'USDC', 'RAY'],
      ['SOL', 'USDC', 'JUP'],
      ['SOL', 'USDT', 'BONK'],
      // Add more paths
    ];

    for (const path of paths) {
      const [tokenA, tokenB, tokenC] = path;

      try {
        // Step 1: A -> B
        const quote1 = await dexAggregator.getBestQuote(
          this.getMint(tokenA),
          this.getMint(tokenB),
          BigInt(1000000) // Start with 1 unit
        );

        // Step 2: B -> C
        const quote2 = await dexAggregator.getBestQuote(
          this.getMint(tokenB),
          this.getMint(tokenC),
          BigInt(quote1.outAmount)
        );

        // Step 3: C -> A
        const quote3 = await dexAggregator.getBestQuote(
          this.getMint(tokenC),
          this.getMint(tokenA),
          BigInt(quote2.outAmount)
        );

        // Calculate profit
        const finalAmount = Number(quote3.outAmount);
        const initialAmount = 1000000;
        const profit = finalAmount - initialAmount;
        const profitBps = (profit / initialAmount) * 10000;

        if (profitBps > 25) { // Minimum 0.25% profit
          opportunities.push({
            path: [tokenA, tokenB, tokenC, tokenA],
            profitBps,
            expectedProfit: profit,
            quotes: [quote1, quote2, quote3],
          });
        }
      } catch (error) {
        // Skip invalid paths
        continue;
      }
    }

    return opportunities;
  }
}
```

---

### 4.3 Phase 3: Market Discovery Integration (3-4 days)

#### Task L-H3: Integrate market-detector Worker

**Current State:** Worker exists at `/workers/market-detector/src/index.ts` but not used

**Required Actions:**

1. **Review market-detector implementation:**
```bash
# Check if worker exists
ls -la workers/market-detector/
```

2. **Add to main workflow:**
- Include in docker-compose.yml
- Connect to Redis channels
- Feed discovered markets to trading-bot

3. **Create market quality scoring:**
```typescript
interface MarketQuality {
  token: string;
  liquidity: number;
  volume24h: number;
  age: number;
  holderCount: number;
  score: number;
}

function scoreMarket(market: MarketQuality): number {
  let score = 0;

  // Liquidity score (0-40)
  score += Math.min(40, market.liquidity / 10000);

  // Volume score (0-30)
  score += Math.min(30, market.volume24h / 50000);

  // Age penalty (0-20, older is better)
  score += Math.min(20, market.age / 86400 * 20);

  // Holder diversity (0-10)
  score += Math.min(10, market.holderCount / 100);

  return score;
}
```

---

## 5. Cross-Coordination Notes

### 5.1 Dependencies on Other Teams

| My Task | Requires From | Status |
|---------|--------------|--------|
| L-C1: Priority fees | SystemArchitect (RPC pool) | Blocking - need stable RPC |
| L-C2: Arbitrage bot | MarketDataEngineer (real-time prices) | Blocking - need price feeds |
| L-C3: Dynamic slippage | MarketDataEngineer (volatility data) | Blocking - need historical prices |
| L-H1: Enhanced quotes | ProtocolIntegration (direct DEX SDKs) | Nice to have |
| L-H2: Triangular arb | MarketDataEngineer (price feeds) | Blocking - need all pairs |
| L-H3: Market discovery | MarketDataEngineer (new markets) | Independent |

### 5.2 What I Need From Others

**From SystemArchitect:**
- RPC connection pool for reliability
- Event replay mechanism (Redis Streams)
- Health monitoring infrastructure

**From MarketDataEngineer:**
- Real-time price feeds for all monitored pairs
- Historical price data for volatility calculation
- Pool liquidity depth information

**From ProtocolIntegration:**
- Direct DEX SDK integrations (beyond Jupiter)
- Orca CLMM pool access
- Meteora DLMM pool access

**From DevOpsSecurity:**
- Secure private key management
- Mainnet deployment configuration
- Monitoring and alerting setup

---

## 6. Recommended MVP Trading Strategy

Given current state and time constraints, recommend implementing:

### Strategy 1: Simple Cross-DEX Arbitrage (Priority: HIGH)

**Why:**
- Lowest complexity
- Immediate profit potential
- Leverages existing DEXAggregator
- No new infrastructure needed

**Implementation:**
- Monitor 5-10 high-volume pairs
- Compare prices across Jupiter, Orca, Raydium
- Execute when profit > 0.5%
- Use Jito bundles for atomic execution

**Expected ROI:**
- 10-50 opportunities per day
- 0.5-2% profit per trade
- $50-500 daily profit (with $10k capital)

### Strategy 2: Burn-and-Buy Enhancement (Priority: MEDIUM)

**Why:**
- Already implemented
- Just needs priority fees and better slippage
- Quick win for mainnet readiness

**Implementation:**
- Add priority fee management
- Implement dynamic slippage
- Add token quality filtering
- Reduce position size for safety

**Expected ROI:**
- 5-20 trades per day
- Highly variable returns
- Higher risk than arbitrage

---

## 7. Success Metrics

### Trading Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Arbitrage opportunities detected** | 10+ per day | Event logs |
| **Successful trades** | 90%+ success rate | Database |
| **Average profit per trade** | > 0.5% | P&L tracking |
| **Priority fee effectiveness** | < 30s confirmation | Transaction logs |
| **Slippage accuracy** | ± 0.2% | Trade vs quote comparison |

### System Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Worker uptime** | 99%+ | Health checks |
| **Event processing latency** | < 1s | Timestamps |
| **RPC failover time** | < 5s | Connection logs |
| **Zero data loss** | 0 missed events | Event replay |

---

## 8. Risk Assessment

### Trading Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Failed transactions on mainnet** | High | Medium | Priority fees, simulation |
| **Slippage eating profits** | Medium | High | Dynamic slippage calculation |
| **Competing bots** | High | High | Faster execution, better routing |
| **Rug pulls on new tokens** | High | Low | Token quality filtering |
| **RPC downtime** | Medium | Medium | Connection pooling |

### Technical Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Event loss during restart** | Medium | High | Redis Streams |
| **Database connection issues** | Low | Low | Connection pooling |
| **Redis failures** | High | Low | Redis persistence, fallback |
| **Memory leaks in workers** | Medium | Low | Monitoring, restarts |

---

## 9. Estimated Timeline

| Phase | Tasks | Duration | Dependencies |
|-------|-------|----------|--------------|
| **Phase 1: Critical** | L-C1, L-C2, L-C3 | 3-5 days | SystemArchitect (RPC pool) |
| **Phase 2: Features** | L-H1, L-H2, L-H3 | 5-7 days | MarketDataEngineer (prices) |
| **Phase 3: Testing** | Integration, stress test | 2-3 days | All teams |
| **Phase 4: Deployment** | Mainnet deployment | 1-2 days | DevOpsSecurity |
| **Total** | | **11-17 days** | |

**Recommended Sprint Plan:**
- **Sprint 1 (Days 1-5):** Priority fees + simple arbitrage
- **Sprint 2 (Days 6-12):** Enhanced strategies + market discovery
- **Sprint 3 (Days 13-17):** Testing + deployment

---

## 10. Next Steps

### Immediate Actions (Day 1-2)

1. **Implement priority fee manager** (L-C1)
   - Create `/packages/solana-client/src/priority-fee-manager.ts`
   - Integrate into DEXAggregator
   - Test on devnet

2. **Review market-detector worker**
   - Assess current implementation
   - Plan integration strategy
   - Identify required changes

3. **Set up price feed monitoring**
   - Coordinate with MarketDataEngineer
   - Define data requirements
   - Create interface contracts

### This Week (Days 3-7)

1. **Complete simple arbitrage bot** (L-C2)
   - Create `/workers/arbitrage-bot/src/index.ts`
   - Implement cross-DEX comparison
   - Test with historical data

2. **Add dynamic slippage** (L-C3)
   - Implement volatility calculation
   - Add size impact consideration
   - Test with varying conditions

### Looking Ahead (Days 8-17)

1. **Enhanced strategies**
   - Triangular arbitrage
   - Market discovery integration
   - Direct DEX routing

2. **Testing & deployment**
   - Integration testing
   - 24-hour stability test
   - Mainnet deployment

---

## Appendix: Key Files Reference

### Trading Bot Core

```
/workers/trading-bot/src/
├── index.ts                    # Main bot logic (needs: priority fees)
└── strategies/                 # NEW - Strategy implementations
    ├── burn-and-buy.ts         # Extract existing strategy
    ├── arbitrage.ts            # NEW - Cross-DEX arbitrage
    └── triangular-arb.ts       # NEW - Triangular arbitrage
```

### Solana Client (Needs Enhancement)

```
/packages/solana-client/src/
├── dex-aggregator.ts           # ADD: Enhanced quote comparison
├── priority-fee-manager.ts     # NEW - Priority fee calculation
├── slippage-calculator.ts      # NEW - Dynamic slippage
└── triangular-arb.ts           # NEW - Triangular arb detection
```

### Event System (Needs Enhancement)

```
/packages/events/src/
├── index.ts                    # ADD: Event versioning
├── streams.ts                  # NEW - Redis Streams wrapper
└── dlq.ts                      # NEW - Dead letter queue
```

---

**Document Status:** Ready for Team Review
**Last Updated:** February 9, 2026
**Next Review:** After Phase 1 completion (Day 5)
