# Liquidity & Arbitrage Strategy Analysis - Solana EDA

**Author:** Liquidity & Arbitrage Strategist
**Date:** 2026-02-09
**Project:** Solana EDA - Trading Strategy Enhancement

---

## Executive Summary

This report identifies the most lucrative trading opportunities on Solana, proposes enhancements to the DEX scoring algorithm, and designs a market discovery system. The current trading bot is limited to a single "burn-and-buy" strategy; this document outlines strategies for cross-DEX arbitrage, orderbook maker rebates, and launchpad bonding curve arbitrage.

---

## 1. Top 5 Lucrative Opportunities on Solana

### Rank 1: Pump.fun Bonding Curve Arbitrage

**Why Lucrative:**
- First-mover advantage on new tokens
- Guaranteed 50-100%+ returns on successful migrations
- Limited competition during bonding curve phase
- Early entry before Raydium liquidity

**Risk Level:** High
- Extreme volatility (10-100x swings common)
- Rug pull risk (estimated 30-40% of launches)
- Competition intensifies near completion
- Liquidity lock verification required

**Complexity:** Medium
- Straightforward bonding curve math
- Simple entry/exit logic
- Migration detection required

**Expected Returns:** 50-500% per successful trade (with 30-40% loss rate)

**Requirements:**
- Real-time Pump.fun monitoring
- Quick execution (<1 second)
- Automatic liquidity lock verification
- Rug detection heuristics

---

### Rank 2: Phoenix Maker Rebates

**Why Lucrative:**
- Earn rebates (0.05-0.1% per trade) for providing liquidity
- Tightest spreads on Solana (0.01-0.05%)
- Low inventory risk with limit orders
- Compounding returns on high volume

**Risk Level:** Medium
- Order sits unfilled until price moves
- Opportunity cost of capital
- Inventory risk on adverse moves
- Competition for best prices

**Complexity:** High
- Orderbook management required
- Dynamic pricing algorithm needed
- Inventory management critical
- Real-time risk monitoring

**Expected Returns:** 0.1-0.3% per trade + rebates (scalable with volume)

**Requirements:**
- Phoenix orderbook monitoring
- Automated limit order placement
- Inventory risk management
- Dynamic spread calculation

---

### Rank 3: Orca CLMM Concentrated Liquidity

**Why Lucrative:**
- High capital efficiency (10-100x vs standard AMM)
- Earn fees from trading volume in tight ranges
- Impermanent loss can be managed with rebalancing
- Growing ecosystem with new pools

**Risk Level:** High
- Significant impermanent loss if price ranges missed
- Active management required
- Competition for best ranges
- Gas fees for frequent rebalancing

**Complexity:** High
- CLMM math is complex
- Range optimization required
- Rebalancing strategy needed
- Fee tier selection critical

**Expected Returns:** 10-50% APY (with active management)

**Requirements:**
- CLMM pool analysis tools
- Range optimization algorithm
- Automated rebalancing
- Fee comparison across tiers

---

### Rank 4: Cross-DEX Arbitrage

**Why Lucrative:**
- Pure profit from price discrepancies
- No directional risk (simultaneous buy/sell)
- Scalable with capital
- Multiple opportunities per day

**Risk Level:** Very High
- Execution speed critical (<400ms for 1 slot)
- Failed transactions eat profits
- MEV competition intense
- Slippage on large sizes

**Complexity:** Very High
- Requires real-time price monitoring across all DEXes
- Transaction must complete in same slot
- Gas optimization essential
- Failure handling complex

**Expected Returns:** 0.5-3% per arbitrage (high variance)

**Requirements:**
- Sub-100ms price feeds
- Parallel transaction submission
- Priority fee optimization
- Fallback strategies

---

### Rank 5: Jupiter Routing Inefficiency

**Why Lucrative:**
- Jupiter doesn't always find optimal routes
- Direct DEX swaps can be cheaper
- Multi-hop opportunities exist
- Route exploitation during volatility

**Risk Level:** High
- Competition from other arbitrageurs
- Jupiter updates routing algorithm
- Slippage on complex routes
- Timing-sensitive

**Complexity:** High
- Route analysis required
- DEX-specific routing knowledge
- Real-time path finding
- Gas cost optimization

**Expected Returns:** 0.2-1% per successful route

**Requirements:**
- Direct DEX integrations (bypass Jupiter)
- Route analysis tools
- Real-time path monitoring
- Fast execution

---

## 2. Enhanced DEX Scoring Algorithm

### Current Algorithm

```typescript
// packages/solana-client/src/dex-aggregator.ts
// Current: Best quote by output amount only
const bestQuote = quotes.reduce((best, current) =>
  current.outputAmount > best.outputAmount ? current : best
);
```

**Limitations:**
- Ignores slippage impact
- Doesn't consider available liquidity
- No priority fee awareness
- No execution speed factor
- Doesn't account for maker rebates

### Proposed Multi-Factor Scoring

```typescript
interface DEXScore {
  priceAdvantage: number;        // 40% weight
  availableLiquidity: number;    // 25% weight
  slippageImpact: number;        // 20% weight
  priorityFee: number;           // 10% weight
  executionSpeed: number;        // 5% weight
  totalScore: number;
}

interface DEXScoreConfig {
  weights: {
    priceAdvantage: number;
    liquidity: number;
    slippage: number;
    priorityFee: number;
    speed: number;
  };
  strategy: 'arbitrage' | 'swing' | 'maker' | 'launchpad';
}

class EnhancedDEXScorer {
  private config: DEXScoreConfig;

  constructor(config: DEXScoreConfig) {
    this.config = config;
  }

  scoreDEX(
    quotes: Quote[],
    tradeSize: number,
    strategy: TradingStrategy
  ): DEXScore[] {
    return quotes.map((quote, index) => {
      const priceAdvantage = this.calculatePriceAdvantage(quote, quotes);
      const liquidity = this.calculateLiquidityScore(quote, tradeSize);
      const slippage = this.calculateSlippageScore(quote, tradeSize);
      const priorityFee = this.calculatePriorityFeeScore(quote);
      const speed = this.calculateSpeedScore(quote);

      const totalScore =
        (priceAdvantage * this.config.weights.priceAdvantage) +
        (liquidity * this.config.weights.liquidity) +
        (slippage * this.config.weights.slippage) +
        (priorityFee * this.config.weights.priorityFee) +
        (speed * this.config.weights.speed);

      return {
        priceAdvantage,
        availableLiquidity: liquidity,
        slippageImpact: slippage,
        priorityFee,
        executionSpeed: speed,
        totalScore,
        dex: quote.dex,
        quote,
      };
    }).sort((a, b) => b.totalScore - a.totalScore);
  }

  private calculatePriceAdvantage(quote: Quote, allQuotes: Quote[]): number {
    // Calculate % advantage over second best
    const sorted = [...allQuotes].sort((a, b) =>
      Number(b.outputAmount) - Number(a.outputAmount)
    );

    if (sorted.length < 2) return 1.0;

    const best = Number(sorted[0].outputAmount);
    const second = Number(sorted[1].outputAmount);

    // Advantage as percentage (0-1 scale)
    return Math.min(1.0, (best - second) / second);
  }

  private calculateLiquidityScore(quote: Quote, tradeSize: number): number {
    // Score based on how much liquidity is available vs trade size
    const availableLiquidity = Number(quote.availableLiquidity || 0);
    const ratio = tradeSize / availableLiquidity;

    // Lower ratio = better score
    // <1% = 1.0, >10% = 0.0
    if (ratio < 0.01) return 1.0;
    if (ratio > 0.10) return 0.0;

    return 1.0 - (ratio / 0.10);
  }

  private calculateSlippageScore(quote: Quote, tradeSize: number): number {
    // Lower slippage = better score
    const slippage = quote.priceImpact || 0;

    // <0.1% = 1.0, >5% = 0.0
    if (slippage < 0.001) return 1.0;
    if (slippage > 0.05) return 0.0;

    return 1.0 - (slippage / 0.05);
  }

  private calculatePriorityFeeScore(quote: Quote): number {
    // Lower priority fee = better score
    const fee = quote.estimatedPriorityFee || 0;

    // <0.0001 SOL = 1.0, >0.01 SOL = 0.0
    if (fee < 0.0001) return 1.0;
    if (fee > 0.01) return 0.0;

    return 1.0 - (fee / 0.01);
  }

  private calculateSpeedScore(quote: Quote): number {
    // Based on DEX type and execution characteristics
    const speedMap: Record<string, number> = {
      'phoenix': 1.0,      // Orderbook, instant
      'openbook': 0.95,    // Orderbook, fast
      'raydium': 0.8,      // AMM, moderate
      'orca': 0.8,         // AMM, moderate
      'meteora': 0.75,     // CLMM, slower
      'jupiter': 0.7,      // Aggregator, variable
      'lifinity': 0.75,    // AMM, moderate
      'pumpfun': 0.9,      // Simple program, fast
    };

    return speedMap[quote.dex] || 0.5;
  }
}
```

### Strategy-Specific Weights

```typescript
const STRATEGY_WEIGHTS: Record<TradingStrategy, Partial<Weights>> = {
  arbitrage: {
    priceAdvantage: 0.50,    // Maximize profit
    liquidity: 0.30,         // Ensure fill
    slippage: 0.15,          // Minimize slippage
    priorityFee: 0.05,       // Low priority
    speed: 0.50,             // Critical for arb
  },
  swing: {
    priceAdvantage: 0.30,    // Good price
    liquidity: 0.40,         // Ensure execution
    slippage: 0.25,          // Minimize impact
    priorityFee: 0.15,       // Willing to pay
    speed: 0.05,             // Not critical
  },
  maker: {
    priceAdvantage: 0.20,    // Not primary
    liquidity: 0.20,
    slippage: 0.10,
    priorityFee: 0.40,       // Minimize fees
    speed: 0.10,
  },
  launchpad: {
    priceAdvantage: 0.10,    // Not applicable
    liquidity: 0.10,
    slippage: 0.50,          // High tolerance
    priorityFee: 0.20,
    speed: 0.60,             // Time-sensitive
  },
};
```

### Local Fee Market Considerations

Some DEXes have more favorable fee structures in certain conditions:

```typescript
interface FeeMarketAdjustments {
  dex: string;
  condition: string;
  adjustment: number; // Multiplier for priority fee score
}

const FEE_MARKET_ADJUSTMENTS: FeeMarketAdjustments[] = [
  {
    dex: 'phoenix',
    condition: 'maker_order',
    adjustment: 2.0, // Bonus for maker rebates
  },
  {
    dex: 'orca',
    condition: 'whirlpool',
    adjustment: 1.2, // Slightly better fees
  },
  {
    dex: 'lifinity',
    condition: 'dynamic_fee_low_volatility',
    adjustment: 1.5, // Dynamic fees can be lower
  },
  {
    dex: 'raydium',
    condition: 'stable_pair',
    adjustment: 1.1, // Stable swap has lower fees
  },
];
```

---

## 3. Market Discovery System

### Architecture

```typescript
interface MarketDiscovery {
  discoverNewPools(): Promise<PoolDiscovery[]>;
  evaluatePool(pool: PoolInfo): Promise<PoolScore>;
  autoAddPool(pool: PoolInfo): Promise<void>;
  scanProtocol(protocol: Protocol): Promise<PoolDiscovery[]>;
}

class AutoMarketDiscovery implements MarketDiscovery {
  private connectionManager: ConnectionManagerV2;
  private redis: Redis;
  private evaluators: Map<Protocol, PoolEvaluator>;

  async start(): Promise<void> {
    // Periodic discovery scans
    setInterval(() => this.scanAllProtocols(), 60000); // Every minute

    // Listen for new pool events
    await this.subscribeToPoolCreationEvents();
  }

  private async scanAllProtocols(): Promise<void> {
    const protocols: Protocol[] = [
      'raydium', 'orca', 'meteora', 'phoenix', 'openbook',
      'lifinity', 'pumpfun'
    ];

    for (const protocol of protocols) {
      try {
        const discovered = await this.scanProtocol(protocol);

        for (const pool of discovered) {
          const score = await this.evaluatePool(pool);

          if (score.passesThreshold) {
            await this.autoAddPool(pool);
          }
        }
      } catch (error) {
        console.error(`Failed to scan ${protocol}:`, error);
      }
    }
  }

  private async subscribeToPoolCreationEvents(): Promise<void> {
    // Subscribe to program logs for pool creation
    const monitoredPrograms = [
      'raydium': '675kPX9MHTjSvztHMAhRV2QfWRkK3F',
      'orca': 'whirLbBCjQxwqx3qiuYsmkL7y2rFqg9J',
      'meteora': 'LBTyrCj6p4t3YqHdNMK3pJ8W9h5Mj',
      'pumpfun': '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P',
    ];

    for (const [protocol, programId] of Object.entries(monitoredPrograms)) {
      this.connectionManager.onLogs(
        { mentions: [programId] },
        async (logs, ctx) => {
          const pool = await this.parsePoolCreation(logs, protocol);
          if (pool) {
            await this.handleNewPool(pool);
          }
        }
      );
    }
  }

  async evaluatePool(pool: PoolInfo): Promise<PoolScore> {
    const evaluator = this.evaluators.get(pool.protocol);
    if (!evaluator) {
      throw new Error(`No evaluator for ${pool.protocol}`);
    }

    return await evaluator.evaluate(pool);
  }

  async autoAddPool(pool: PoolInfo): Promise<void> {
    // Add to monitoring
    await this.redis.publish('events:pools', JSON.stringify({
      type: 'pool_discovered',
      pool,
      timestamp: Date.now(),
    }));

    // Subscribe to pool account
    await this.connectionManager.subscribeToAccounts(
      [pool.address],
      { priority: 'medium' }
    );

    // Add to database
    await this.prisma.monitoredPool.create({
      data: {
        address: pool.address,
        protocol: pool.protocol,
        tokenA: pool.tokenA,
        tokenB: pool.tokenB,
        discoveredAt: new Date(),
        active: true,
      },
    });
  }
}
```

### Pool Evaluation Criteria

```typescript
interface PoolScore {
  liquidity: number;        // 0-1
  volume24h: number;        // 0-1
  feeTier: number;          // 0-1
  age: number;              // 0-1
  volatility: number;       // 0-1
  score: number;            // Weighted sum
  passesThreshold: boolean; // score > 0.5
}

class PoolEvaluator {
  async evaluate(pool: PoolInfo): Promise<PoolScore> {
    const liquidity = this.scoreLiquidity(pool);
    const volume = this.scoreVolume(pool);
    const fees = this.scoreFees(pool);
    const age = this.scoreAge(pool);
    const volatility = this.scoreVolatility(pool);

    // Weights for different strategies
    const weights = this.getWeightsForStrategy();

    const score =
      (liquidity * weights.liquidity) +
      (volume * weights.volume) +
      (fees * weights.fees) +
      (age * weights.age) +
      (volatility * weights.volatility);

    return {
      liquidity,
      volume24h: volume,
      feeTier: fees,
      age,
      volatility,
      score,
      passesThreshold: score > 0.5,
    };
  }

  private scoreLiquidity(pool: PoolInfo): number {
    // Min $10K liquidity
    const minLiquidity = 10000;
    const liquidity = pool.liquidity || 0;

    return Math.min(1.0, liquidity / minLiquidity);
  }

  private scoreVolume(pool: PoolInfo): number {
    // Min $50K daily volume
    const minVolume = 50000;
    const volume = pool.volume24h || 0;

    return Math.min(1.0, volume / minVolume);
  }

  private scoreFees(pool: PoolInfo): number {
    // Prefer 0.05%-0.3% fee tiers
    const fee = pool.feeTier || 0;

    if (fee >= 0.0005 && fee <= 0.003) return 1.0;
    if (fee < 0.0005) return 0.5; // Too low = low rewards
    if (fee > 0.01) return 0.3;   // Too high = less volume

    return 0.7;
  }

  private scoreAge(pool: PoolInfo): number {
    // For new opportunities: prefer pools < 7 days old
    const ageMs = Date.now() - pool.createdAt;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    if (ageDays < 1) return 1.0;      // Very new
    if (ageDays < 7) return 0.8;      // New
    if (ageDays < 30) return 0.5;     // Established
    return 0.3;                        // Old
  }

  private scoreVolatility(pool: PoolInfo): number {
    // Moderate volatility is good for trading
    const vol = pool.volatility || 0;

    if (vol < 0.05) return 0.3;   // Too stable = no opportunities
    if (vol < 0.20) return 1.0;   // Sweet spot
    if (vol < 0.50) return 0.7;   // Manageable
    return 0.3;                     // Too volatile = risky
  }
}
```

### Discovery by Protocol

```typescript
class ProtocolSpecificDiscovery {
  // Raydium: Scan for new pools via program logs
  async discoverRaydiumPools(): Promise<PoolInfo[]> {
    const logs = await this.getProgramLogs('675kPX9MHTjSvztHMAhRV2QfWRkK3F');

    return logs
      .filter(log => log.includes('InitializePool'))
      .map(log => this.parseRaydiumPool(log));
  }

  // Orca: Fetch from Whirlpools registry
  async discoverOrcaPools(): Promise<PoolInfo[]> {
    const registry = await this.fetchOrcaRegistry();

    return registry.pools.map(pool => ({
      address: pool.address,
      protocol: 'orca',
      tokenA: pool.tokenA,
      tokenB: pool.tokenB,
      feeTier: pool.feeRate,
      liquidity: pool.tvl,
      createdAt: pool.createdAt,
    }));
  }

  // Pump.fun: Monitor bonding curve creations
  async discoverPumpFunCurves(): Promise<PoolInfo[]> {
    const logs = await this.getProgramLogs('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');

    return logs
      .filter(log => log.includes('CreateBondingCurve'))
      .map(log => this.parsePumpFunCurve(log));
  }

  // Phoenix: Get markets from API
  async discoverPhoenixMarkets(): Promise<PoolInfo[]> {
    const response = await fetch('https://api.phoenix.solana.com/markets');
    const markets = await response.json();

    return markets.map(m => ({
      address: m.address,
      protocol: 'phoenix',
      tokenA: m.baseToken,
      tokenB: m.quoteToken,
      liquidity: m.liquidity,
      volume24h: m.volume24h,
    }));
  }
}
```

---

## 4. New Trading Strategy Specifications

### Strategy 1: Bonding Curve Arbitrage (Pump.fun)

**Objective:** Buy tokens during bonding curve phase, sell upon DEX migration

**Entry Conditions:**
- Bonding curve at 20-60% progression
- Minimum raised: $5,000
- Liquidity lock verified
- Social signal positive (Twitter mentions > 100)
- No rug indicators

**Exit Conditions:**
- Migration to Raydium detected (100% progression)
- Take profit at 2-3x entry price
- Stop loss if liquidity lock fails

**Risk Parameters:**
- Max position size: 0.1 SOL per token
- Max concurrent positions: 5
- Stop loss: 50% (rug detection)
- Take profit: 200-300%

**Expected Returns:**
- Win rate: 60-70%
- Average win: 150%
- Average loss: 50%
- Expected value: +65% per trade

```typescript
class BondingCurveArbitrageStrategy {
  async evaluate(curve: BondingCurveInfo): Promise<TradeDecision> {
    const score = this.calculateCurveScore(curve);

    if (score > 0.7) {
      return {
        action: 'buy',
        amount: this.calculatePositionSize(curve),
        reason: 'Strong bonding curve signal',
      };
    }

    return { action: 'hold' };
  }

  private calculateCurveScore(curve: BondingCurveInfo): number {
    let score = 0;

    // Progression score (20-60% optimal)
    if (curve.progression >= 20 && curve.progression <= 60) {
      score += 0.3;
    } else if (curve.progression > 60 && curve.progression < 90) {
      score += 0.1;
    }

    // Raised amount score
    const raised = curve.raised || 0;
    if (raised >= 5000) score += 0.2;
    if (raised >= 10000) score += 0.1;

    // Liquidity lock verification
    if (curve.liquidityLocked) score += 0.3;

    // Social signals
    const socialScore = this.evaluateSocialSignals(curve);
    score += socialScore * 0.1;

    return Math.min(1.0, score);
  }
}
```

### Strategy 2: Phoenix Maker Strategy

**Objective:** Earn rebates by providing limit order liquidity

**Entry Conditions:**
- Spread > 0.05% (profitable to provide liquidity)
- Sufficient volume on the pair
- Inventory balance maintained

**Exit Conditions:**
- Order filled (automatic)
- Rebalance if inventory skewed > 20%

**Risk Parameters:**
- Max inventory per side: 10 SOL
- Rebalance threshold: ±20%
- Order size: 0.1-1 SOL
- Spread target: 0.1-0.3%

**Expected Returns:**
- Rebate income: 0.05-0.1% per trade
- Volume-dependent: 100-500 trades/day possible
- Expected daily return: 0.5-2%

```typescript
class PhoenixMakerStrategy {
  private inventory: Map<string, InventoryState> = new Map();

  async placeMakerOrders(market: PhoenixMarket): Promise<void> {
    const state = this.inventory.get(market.address) ||
      this.initializeInventory(market);

    // Calculate fair price
    const fairPrice = await this.getFairPrice(market);

    // Place bids below fair price
    const bidPrice = fairPrice * (1 - this.getSpread(market));
    await this.placeLimitOrder(market, 'buy', bidPrice, this.getOrderSize());

    // Place asks above fair price
    const askPrice = fairPrice * (1 + this.getSpread(market));
    await this.placeLimitOrder(market, 'sell', askPrice, this.getOrderSize());
  }

  private getSpread(market: PhoenixMarket): number {
    // Dynamic spread based on volatility
    const vol = market.volatility || 0.01;

    if (vol < 0.02) return 0.001;  // 0.1% spread
    if (vol < 0.05) return 0.002;  // 0.2% spread
    return 0.003;                   // 0.3% spread
  }

  async rebalanceInventory(market: PhoenixMarket): Promise<void> {
    const state = this.inventory.get(market.address);
    if (!state) return;

    const skew = (state.baseTokens - state.quoteTokens * state.fairPrice) /
      (state.baseTokens + state.quoteTokens * state.fairPrice);

    if (Math.abs(skew) > 0.2) {
      // Rebalance by swapping excess tokens
      await this.rebalance(market, skew);
    }
  }
}
```

### Strategy 3: Cross-DEX Arbitrage

**Objective:** Profit from price differences across DEXes

**Entry Conditions:**
- Price difference > gas + slippage + profit margin (min 0.5%)
- Sufficient liquidity on both DEXes
- Can execute in single slot

**Exit Conditions:**
- Simultaneous execution (buy and sell in same transaction)
- Fallback: hold position if one leg fails

**Risk Parameters:**
- Min profit margin: 0.5%
- Max trade size: Based on liquidity
- Timeout: 400ms (1 slot)
- Fallback: Manual intervention

**Expected Returns:**
- Opportunities: 10-50 per day
- Success rate: 70-80%
- Average profit: 0.5-2% per trade
- Failed trades: -0.1% (gas)

```typescript
class CrossDEXArbitrageStrategy {
  async scanOpportunities(): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];

    // Get all trading pairs
    const pairs = await this.getActivePairs();

    for (const pair of pairs) {
      // Get quotes from all DEXes
      const quotes = await this.getAllQuotes(pair);

      // Find price differences
      for (let i = 0; i < quotes.length; i++) {
        for (let j = i + 1; j < quotes.length; j++) {
          const profit = this.calculateProfit(quotes[i], quotes[j]);

          if (profit > 0.005) { // 0.5% minimum
            opportunities.push({
              pair,
              buyDex: quotes[i].dex,
              sellDex: quotes[j].dex,
              buyPrice: quotes[i].price,
              sellPrice: quotes[j].price,
              profitPercent: profit,
              estimatedGas: this.estimateGas(quotes[i], quotes[j]),
            });
          }
        }
      }
    }

    return opportunities.sort((a, b) => b.profitPercent - a.profitPercent);
  }

  async executeArbitrage(op: ArbitrageOpportunity): Promise<boolean> {
    try {
      // Build transaction with both legs
      const transaction = await this.buildArbitrageTransaction(op);

      // Calculate optimal priority fee
      const priorityFee = this.calculatePriorityFee(op);

      // Execute with timeout
      const result = await this.executeWithTimeout(transaction, {
        commitment: 'processed',
        priorityFee,
        timeout: 400, // ms
      });

      return result.success;
    } catch (error) {
      console.error('Arbitrage execution failed:', error);
      return false;
    }
  }
}
```

---

## 5. Priority Fee Strategy

### Dynamic Fee Calculation

```typescript
class PriorityFeeStrategy {
  private feeHistory: FeeHistoryEntry[] = [];

  async getOptimalFee(
    tradeSize: number,
    urgency: 'immediate' | 'normal' | 'patient',
    expectedProfit: number
  ): Promise<number> {
    const congestion = await this.getNetworkCongestion();
    const baseFee = this.getBaseFee(congestion);

    // Adjust based on urgency
    const urgencyMultiplier = this.getUrgencyMultiplier(urgency);

    // Adjust based on profit (don't overpay for small profits)
    const profitMultiplier = this.getProfitMultiplier(expectedProfit);

    // DEX-specific adjustments
    const dexMultiplier = await this.getDEXFeeMultiplier();

    return baseFee * urgencyMultiplier * profitMultiplier * dexMultiplier;
  }

  private async getNetworkCongestion(): Promise<'low' | 'medium' | 'high'> {
    // Monitor recent block fees
    const recentBlocks = await this.getRecentBlockFees(100);

    const avgFee = recentBlocks.reduce((sum, b) => sum + b.priorityFee, 0) / recentBlocks.length;

    if (avgFee < 0.0001) return 'low';
    if (avgFee < 0.001) return 'medium';
    return 'high';
  }

  private getBaseFee(congestion: string): number {
    const baseFees = {
      low: 0.00001,    // 10,000 lamports
      medium: 0.0001,  // 100,000 lamports
      high: 0.001,     // 1,000,000 lamports
    };

    return baseFees[congestion];
  }

  private getUrgencyMultiplier(urgency: string): number {
    const multipliers = {
      immediate: 10.0,
      normal: 2.0,
      patient: 1.0,
    };

    return multipliers[urgency];
  }

  private getProfitMultiplier(profit: number): number {
    // Don't overpay for small profits
    if (profit < 0.01) return 0.5;   // 1% profit
    if (profit < 0.05) return 1.0;   // 5% profit
    return 2.0;                       // 5%+ profit
  }

  private async getDEXFeeMultiplier(): Promise<number> {
    // Some DEXes require higher fees during congestion
    return 1.0; // Base multiplier
  }
}
```

### Fee Monitoring

```typescript
class FeeMonitor {
  async start(): Promise<void> {
    // Monitor fees every slot
    setInterval(async () => {
      const stats = await this.collectFeeStats();
      await this.publishFeeStats(stats);
    }, 400); // ~1 slot

    // Build fee history for predictions
    this.buildFeeHistory();
  }

  private async collectFeeStats(): Promise<FeeStats> {
    const recentBlocks = await this.getRecentBlocks(100);

    const fees = recentBlocks.map(b => b.priorityFee);

    return {
      min: Math.min(...fees),
      max: Math.max(...fees),
      avg: fees.reduce((a, b) => a + b) / fees.length,
      p50: this.percentile(fees, 50),
      p75: this.percentile(fees, 75),
      p90: this.percentile(fees, 90),
      p95: this.percentile(fees, 95),
    };
  }

  predictRequiredFee(confidence: number): number {
    // Use fee history to predict required fee
    const recent = this.feeHistory.slice(-100);

    switch (confidence) {
      case 0.50: return this.percentile(recent, 50);
      case 0.75: return this.percentile(recent, 75);
      case 0.90: return this.percentile(recent, 90);
      case 0.95: return this.percentile(recent, 95);
      default: return this.percentile(recent, 50);
    }
  }
}
```

---

## 6. Implementation Roadmap

### Phase 1: Enhanced DEX Scoring (Week 1)
- [ ] Implement multi-factor scoring algorithm
- [ ] Add strategy-specific weights
- [ ] Integrate with existing DEXAggregator
- [ ] Unit tests for scoring logic

### Phase 2: Market Discovery System (Weeks 2-3)
- [ ] Implement pool evaluators for each protocol
- [ ] Create discovery scanners
- [ ] Add auto-add logic
- [ ] Integrate with workers

### Phase 3: Bonding Curve Strategy (Week 4)
- [ ] Implement Pump.fun monitoring
- [ ] Add bonding curve evaluation
- [ ] Create migration detection
- [ ] Implement trading logic

### Phase 4: Phoenix Maker Strategy (Weeks 5-6)
- [ ] Implement orderbook monitoring
- [ ] Create limit order placement
- [ ] Add inventory management
- [ ] Implement rebalancing

### Phase 5: Cross-DEX Arbitrage (Weeks 7-8)
- [ ] Implement opportunity scanner
- [ ] Create arbitrage executor
- [ ] Add fallback strategies
- [ ] Optimize for speed

### Phase 6: Priority Fee Optimization (Week 9)
- [ ] Implement fee monitoring
- [ ] Create dynamic fee calculation
- [ ] Add fee prediction
- [ ] Integrate with all strategies

**Total: 9 weeks for complete implementation**

---

## Conclusion

The proposed enhancements will transform the Solana EDA trading bot from a single-strategy system into a sophisticated multi-strategy platform:

1. **Top Opportunities Identified:** Pump.fun, Phoenix maker, CLMM, arbitrage
2. **Enhanced DEX Scoring:** Multi-factor algorithm with strategy-specific weights
3. **Market Discovery:** Automatic pool detection and evaluation
4. **New Strategies:** Bonding curve arbitrage, maker rebates, cross-DEX arbitrage
5. **Priority Fee Optimization:** Dynamic fee calculation based on network conditions

**Expected Impact:**
- 10-50x more trading opportunities
- Diversified revenue streams
- Reduced risk through multiple strategies
- Competitive advantage in Solana DeFi

---

**Document Version:** 1.0
**Last Updated:** 2026-02-09
**Status:** Draft for Review
