# Market Data Pipeline Analysis & Architecture Report

**Author:** Market Data Engineer
**Date:** 2026-02-09
**Project:** Solana EDA - Multi-Market Integration Strategy

---

## Executive Summary

This report analyzes the current Solana EDA data pipeline architecture and provides detailed recommendations for extending the system to support multiple market types (AMM, Orderbook, Launchpad). The current system is well-architected for AMM-based liquidity monitoring but requires significant enhancements to handle orderbook DEXes (Phoenix, OpenBook) and launchpad platforms (Pump.fun).

### Key Findings

| Area | Current State | Required State | Gap |
|------|---------------|----------------|-----|
| **Event Schema** | AMM-focused (pool state changes) | Multi-market unified schema | Medium |
| **Connection Management** | Single connection per worker | Connection pooling with smart routing | High |
| **Market Type Support** | AMM only (Orca, Raydium, Meteora) | AMM + Orderbook + Launchpad | High |
| **Subscription Management** | AccountWatcher with single connection | Priority-based batch subscriptions | High |
| **Data Processing** | Real-time pool state changes | Orderbook deltas + bonding curves | High |

---

## 1. Standardized Event Schema Proposal

### 1.1 Current Event Schema Limitations

The existing event schema (`packages/events/src/index.ts`) is designed around AMM-specific concepts:

```typescript
// Current AMM-focused events
- LIQUIDITY_CHANGED  // Pool TVL/reserve changes
- PRICE_UPDATE       // Aggregate price from DEXes
- POOL_DISCOVERED    // New pool detected
- MARKET_DISCOVERED  // New market (limited to known DEXes)
```

**Limitations:**
- No native support for orderbook events (bid/ask updates, trade executions)
- No bonding curve progression events for launchpad tokens
- No unified market abstraction across different market types
- Missing order depth and liquidity distribution metrics

### 1.2 Proposed Unified Market Event Interface

```typescript
/**
 * Unified market event interface supporting all market types
 */
interface MarketEvent {
  // Event identification
  eventId: string;
  eventType: MarketEventType;
  eventTimestamp: number;
  slot: number;
  signature?: string;

  // Market identification
  marketType: MarketType;
  marketAddress: string;
  protocol: MarketProtocol;
  baseMint: string;
  quoteMint: string;

  // Event data (discriminated union by eventType)
  data: MarketEventData;

  // Metadata
  confidence: number;
  source: string;
}

/**
 * Market event types (discriminator for data field)
 */
type MarketEventType =
  // AMM events
  | 'pool_state_changed'
  | 'liquidity_added'
  | 'liquidity_removed'
  // Orderbook events
  | 'orderbook_snapshot'
  | 'orderbook_updated'
  | 'order_placed'
  | 'order_cancelled'
  | 'order_filled'
  | 'trade_executed'
  // Launchpad events
  | 'bonding_curve_progress'
  | 'bonding_curve_complete'
  | 'dex_migration';

/**
 * Market type classification
 */
type MarketType = 'amm' | 'orderbook' | 'launchpad' | 'hybrid';

/**
 * Supported protocols per market type
 */
type MarketProtocol =
  // AMM
  | 'jupiter'
  | 'orca'
  | 'raydium'
  | 'meteora'
  | 'lifinity'
  // Orderbook
  | 'phoenix'
  | 'openbook'
  | 'crema'
  // Launchpad
  | 'pumpfun'
  | 'moonshot';

/**
 * Discriminated union for event-specific data
 */
type MarketEventData =
  // AMM data
  | AMMPoolStateData
  | AMMLiquidityChangeData
  // Orderbook data
  | OrderbookSnapshotData
  | OrderbookUpdateData
  | OrderEventData
  | TradeEventData
  // Launchpad data
  | BondingCurveData;

// ============================================
// AMM Event Data Types
// ============================================

interface AMMPoolStateData {
  reserveA: string;
  reserveB: string;
  tvl: string;
  price: string;
  feeRate: number;
  lpSupply: string;
  tickCurrentIndex?: number; // For CLMM
}

interface AMMLiquidityChangeData {
  changeType: 'add' | 'remove';
  amountA: string;
  amountB: string;
  lpTokens: string;
  newTvl: string;
  priceImpact: number;
}

// ============================================
// Orderbook Event Data Types
// ============================================

interface OrderbookSnapshotData {
  sequenceNumber: number;
  bids: OrderLevel[];
  asks: OrderLevel[];
  bestBid: OrderLevel;
  bestAsk: OrderLevel;
  spread: number;
  spreadBps: number;
  depth: number;
}

interface OrderbookUpdateData {
  sequenceNumber: number;
  updates: OrderLevelUpdate[];
  side: 'bid' | 'ask' | 'both';
  bestBid?: OrderLevel;
  bestAsk?: OrderLevel;
  updateType: 'delta' | 'snapshot';
}

interface OrderLevel {
  price: string;
  size: string;
  ordersCount: number;
}

interface OrderLevelUpdate {
  price: string;
  size: string;
  action: 'update' | 'delete' | 'insert';
}

interface OrderEventData {
  orderId: string;
  clientOrderId?: string;
  side: 'buy' | 'sell';
  orderType: 'limit' | 'market' | 'ioc' | 'post_only';
  price: string;
  size: string;
  sizeFilled: string;
  status: 'open' | 'filled' | 'cancelled' | 'expired';
  timestamp: number;
  maker?: boolean;
}

interface TradeEventData {
  tradeId: string;
  takerSide: 'buy' | 'sell';
  price: string;
  size: string;
  quoteQuantity: string;
  fee: string;
  makerOrderId: string;
  takerOrderId: string;
  timestamp: number;
  sequenceNumber?: number;
}

// ============================================
// Launchpad Event Data Types
// ============================================

interface BondingCurveData {
  curveType: 'linear' | 'exponential';
  progress: number; // 0-100%
  currentPrice: string;
  marketCap?: string;
  holders: number;
  bondingCurveAddress: string;
  targetDex?: MarketProtocol; // Target DEX after migration
  targetPool?: string; // Target pool address after migration
  stage: 'bonding' | 'migration' | 'trading';
}

// ============================================
// Unified Price Data (for all market types)
// ============================================

interface UnifiedPrice {
  marketType: MarketType;
  protocol: MarketProtocol;
  marketAddress: string;
  price: string;
  confidence: number;
  source: 'mid_price' | 'last_trade' | 'vwap' | 'bonding_curve';
  volume24h?: string;
  spread?: number;
  liquidity?: string;
  timestamp: number;
}
```

### 1.3 Event Normalization Strategy

Different market types require different normalization approaches:

#### AMM Normalization
```
Raw: ReserveA=1000, ReserveB=2000
     → Calculate price: ReserveB/ReserveA
     → Emit: pool_state_changed event
```

#### Orderbook Normalization
```
Raw: Bids=[(100, 10), (99, 20)], Asks=[(101, 5)]
     → Calculate mid_price: (bestBid + bestAsk) / 2
     → Calculate spread: (bestAsk - bestBid) / bestBid
     → Emit: orderbook_snapshot event
     → Emit: price_update with source='mid_price'
```

#### Launchpad Normalization
```
Raw: Bonding curve at 45% progression
     → Calculate current_price from curve formula
     → Calculate market_cap from price * supply
     → Emit: bonding_curve_progress event
     → Emit: price_update with source='bonding_curve'
```

---

## 2. Worker Architecture Extension Proposal

### 2.1 Current Worker Architecture

The system currently has three ETL workers:

| Worker | Purpose | Subscriptions | Output |
|--------|---------|---------------|--------|
| `liquidity-monitor` | AMM pool changes | Pool accounts | `LIQUIDITY_CHANGED` events |
| `price-aggregator` | Price polling | HTTP API (Jupiter) | `PRICE_UPDATE` events |
| `burn-detector` | Token burn detection | Token mint accounts | `BURN_DETECTED` events |

**Limitations:**
- No orderbook subscription support
- No real-time orderbook depth tracking
- No bonding curve monitoring
- Each worker uses single SolanaConnectionManager instance

### 2.2 Extended Worker Architecture

#### 2.2.1 Enhanced Liquidity Monitor (AMM + Orderbook)

```typescript
/**
 * Enhanced liquidity monitor supporting both AMM and orderbook markets
 */
class EnhancedLiquidityMonitor {
  private connectionPool: ConnectionPool;
  private ammWatcher: AMMPoolWatcher;
  private orderbookWatcher: OrderbookWatcher;
  private eventNormalizer: MarketEventNormalizer;
  private redis: Redis;

  async start() {
    // Initialize connection pool for multiple subscriptions
    await this.connectionPool.initialize({
      maxConnections: 5,
      subscriptionsPerConnection: 1000,
    });

    // Start AMM monitoring (existing pools)
    await this.ammWatcher.start(this.connectionPool);

    // Start orderbook monitoring (new feature)
    await this.orderbookWatcher.start(this.connectionPool);

    // Subscribe to market discovery for dynamic additions
    await this.subscribeToMarketDiscovery();
  }

  // ... implementation
}

/**
 * Orderbook watcher for Phoenix and OpenBook markets
 */
class OrderbookWatcher {
  private watchedMarkets: Map<string, OrderbookState>;
  private subscriptionManager: SubscriptionManager;

  async watchMarket(marketAddress: string, protocol: MarketProtocol) {
    switch (protocol) {
      case 'phoenix':
        return this.watchPhoenixMarket(marketAddress);
      case 'openbook':
        return this.watchOpenBookMarket(marketAddress);
      default:
        throw new Error(`Unsupported orderbook protocol: ${protocol}`);
    }
  }

  private async watchPhoenixMarket(marketAddress: string) {
    // Phoenix uses a single account for the entire orderbook
    // Subscribe to account changes for orderbook updates
    const subscription = await this.connectionPool.subscribe(
      marketAddress,
      'high', // priority
      async (accountInfo, context) => {
        const orderbook = this.parsePhoenixOrderbook(accountInfo);
        await this.handleOrderbookUpdate(marketAddress, orderbook);
      }
    );
  }

  private async handleOrderbookUpdate(
    marketAddress: string,
    orderbook: OrderbookSnapshot
  ) {
    const prevState = this.watchedMarkets.get(marketAddress);

    if (!prevState) {
      // Initial snapshot
      const event: MarketEvent = {
        eventId: generateEventId(),
        eventType: 'orderbook_snapshot',
        eventTimestamp: Date.now(),
        slot: orderbook.slot,
        marketType: 'orderbook',
        marketAddress,
        protocol: 'phoenix',
        baseMint: orderbook.baseMint,
        quoteMint: orderbook.quoteMint,
        data: {
          sequenceNumber: orderbook.sequenceNumber,
          bids: orderbook.bids,
          asks: orderbook.asks,
          bestBid: orderbook.bids[0],
          bestAsk: orderbook.asks[0],
          spread: this.calculateSpread(orderbook),
          spreadBps: this.calculateSpreadBps(orderbook),
          depth: this.calculateDepth(orderbook),
        },
        confidence: 1.0,
        source: 'phoenix-watcher',
      };

      await this.redis.publish('events:orderbook', JSON.stringify(event));
      this.watchedMarkets.set(marketAddress, orderbook);
    } else {
      // Delta update
      const delta = this.calculateOrderbookDelta(prevState, orderbook);
      const event: MarketEvent = {
        eventId: generateEventId(),
        eventType: 'orderbook_updated',
        eventTimestamp: Date.now(),
        slot: orderbook.slot,
        marketType: 'orderbook',
        marketAddress,
        protocol: 'phoenix',
        baseMint: orderbook.baseMint,
        quoteMint: orderbook.quoteMint,
        data: {
          sequenceNumber: orderbook.sequenceNumber,
          updates: delta.updates,
          side: delta.side,
          bestBid: orderbook.bids[0],
          bestAsk: orderbook.asks[0],
          updateType: 'delta',
        },
        confidence: 1.0,
        source: 'phoenix-watcher',
      };

      await this.redis.publish('events:orderbook', JSON.stringify(event));
      this.watchedMarkets.set(marketAddress, orderbook);
    }
  }

  private parsePhoenixOrderbook(accountInfo: AccountInfo<Buffer>): OrderbookSnapshot {
    // Phoenix orderbook parsing logic
    // Phoenix stores orderbook in a compact binary format
    // Implementation details: https://docs.elusiv.io/pdfs/phoenix.pdf
    const data = accountInfo.data;

    // Parse header
    const MARKET_STATUS_OFFSET = 0;
    const SEQUENCE_NUMBER_OFFSET = 8;

    const marketStatus = data[MARKET_STATUS_OFFSET];
    const sequenceNumber = data.readBigUInt64LE(SEQUENCE_NUMBER_OFFSET);

    // Parse orderbook levels
    const BIDS_OFFSET = 16;
    const ASKS_OFFSET = BIDS_OFFSET + 1024; // 1024 bytes for bids

    const bids = this.parsePhoenixLevels(data.slice(BIDS_OFFSET, ASKS_OFFSET), 'bid');
    const asks = this.parsePhoenixLevels(data.slice(ASKS_OFFSET), 'ask');

    return {
      marketAddress: accountInfo.address.toString(),
      sequenceNumber: Number(sequenceNumber),
      bids,
      asks,
      baseMint: '', // Extract from market account
      quoteMint: '',
      slot: 0, // From context
    };
  }
}
```

#### 2.2.2 Enhanced Price Aggregator

```typescript
/**
 * Enhanced price aggregator supporting all market types
 */
class EnhancedPriceAggregator {
  private ammPriceSource: AMMPriceSource;
  private orderbookPriceSource: OrderbookPriceSource;
  private launchpadPriceSource: LaunchpadPriceSource;
  private priceCalculator: PriceCalculator;
  private confidenceScorer: ConfidenceScorer;

  async start() {
    // Subscribe to all market event channels
    await this.subscribeToMarketEvents();

    // Start periodic price aggregation
    setInterval(() => this.aggregatePrices(), 1000);
  }

  private async subscribeToMarketEvents() {
    // Subscribe to orderbook events for mid-price calculation
    await this.redis.subscribe('events:orderbook');
    this.redis.on('message', (channel, message) => {
      if (channel === 'events:orderbook') {
        const event: MarketEvent = JSON.parse(message);
        this.handleOrderbookEvent(event);
      }
    });

    // Subscribe to AMM liquidity events
    await this.redis.subscribe('events:liquidity');
    this.redis.on('message', (channel, message) => {
      if (channel === 'events:liquidity') {
        const event: MarketEvent = JSON.parse(message);
        this.handleLiquidityEvent(event);
      }
    });

    // Subscribe to launchpad bonding curve events
    await this.redis.subscribe('events:launchpad');
    this.redis.on('message', (channel, message) => {
      if (channel === 'events:launchpad') {
        const event: MarketEvent = JSON.parse(message);
        this.handleBondingCurveEvent(event);
      }
    });
  }

  private handleOrderbookEvent(event: MarketEvent) {
    if (event.eventType === 'orderbook_snapshot' ||
        event.eventType === 'orderbook_updated') {
      const data = event.data as OrderbookSnapshotData | OrderbookUpdateData;

      // Calculate mid-price from best bid/ask
      const midPrice = this.priceCalculator.calculateMidPrice(
        data.bestBid.price,
        data.bestAsk.price
      );

      // Calculate price confidence based on spread
      const spread = data.spread || 0;
      const spreadBps = data.spreadBps || 0;
      const confidence = this.confidenceScorer.scoreFromSpread(spreadBps);

      // Store price for aggregation
      this.priceCache.set(event.marketAddress, {
        marketType: 'orderbook',
        protocol: event.protocol,
        price: midPrice,
        confidence,
        source: 'mid_price',
        timestamp: event.eventTimestamp,
        liquidity: data.depth?.toString(),
        spread: spread.toString(),
      });
    }
  }

  private async aggregatePrices() {
    const pricesByPair = this.groupPricesByTokenPair();

    for (const [pair, sources] of pricesByPair.entries()) {
      // Calculate VWAP across all sources
      const vwap = this.priceCalculator.calculateVWAP(sources);

      // Calculate aggregated confidence
      const aggregatedConfidence = this.confidenceScorer.aggregate(sources);

      // Emit price update event
      const event: MarketEvent = {
        eventId: generateEventId(),
        eventType: 'price_update',
        eventTimestamp: Date.now(),
        slot: 0,
        marketType: 'amm', // Dominant market type
        marketAddress: '',
        protocol: 'aggregated',
        baseMint: pair.base,
        quoteMint: pair.quote,
        data: {
          price: vwap.toString(),
          confidence: aggregatedConfidence,
          sources: sources.map(s => ({
            protocol: s.protocol,
            price: s.price.toString(),
            confidence: s.confidence,
            source: s.source,
          })),
        },
        confidence: aggregatedConfidence,
        source: 'price-aggregator',
      };

      await this.redis.publish('events:price', JSON.stringify(event));
    }
  }
}

/**
 * Confidence scorer for price data
 */
class ConfidenceScorer {
  /**
   * Score price based on orderbook spread
   * Tighter spread = higher confidence
   */
  scoreFromSpread(spreadBps: number): number {
    // Spreads under 10 bps get near-perfect confidence
    // Spreads over 100 bps get low confidence
    if (spreadBps <= 10) return 0.95;
    if (spreadBps <= 25) return 0.85;
    if (spreadBps <= 50) return 0.70;
    if (spreadBps <= 100) return 0.50;
    return 0.30;
  }

  /**
   * Aggregate confidence from multiple sources
   * Higher weight for sources with more volume/liquidity
   */
  aggregate(sources: PriceSource[]): number {
    const totalWeight = sources.reduce((sum, s) => sum + (s.liquidity || 0), 0);
    if (totalWeight === 0) {
      return sources.reduce((sum, s) => sum + s.confidence, 0) / sources.length;
    }

    const weightedSum = sources.reduce((sum, s) => {
      const weight = s.liquidity || 1;
      return sum + (s.confidence * weight);
    }, 0);

    return weightedSum / totalWeight;
  }
}
```

#### 2.2.3 New Launchpad Monitor Worker

```typescript
/**
 * Launchpad monitor for Pump.fun and similar platforms
 */
class LaunchpadMonitor {
  private connectionPool: ConnectionPool;
  private watchedTokens: Map<string, BondingCurveState>;
  private redis: Redis;

  async start() {
    await this.connectionPool.initialize({
      maxConnections: 2,
      subscriptionsPerConnection: 500,
    });

    // Subscribe to Pump.fun program logs
    await this.subscribeToPumpFunProgram();

    // Monitor known bonding curve accounts
    await this.monitorKnownBondingCurves();
  }

  private async subscribeToPumpFunProgram() {
    // Pump.fun program ID
    const PUMP_FUN_PROGRAM = new PublicKey('6EF8rrecthR5Dkjon8nfgcKbT5hP5hYqW5hFjRjhKp');

    // Subscribe to program logs for new bonding curve creations
    this.connectionPool.onLogs(
      { mentions: [PUMP_FUN_PROGRAM] },
      async (logs, context) => {
        await this.handlePumpFunLogs(logs, context);
      }
    );
  }

  private async handlePumpFunLogs(logs: any, context: any) {
    // Parse logs for bonding curve creation events
    for (const log of logs.logs) {
      if (log.includes('InitializeBondingCurve')) {
        const bondingCurveAddress = this.extractBondingCurveAddress(log);
        await this.watchBondingCurve(bondingCurveAddress);
      }
    }
  }

  private async watchBondingCurve(curveAddress: string) {
    const subscription = await this.connectionPool.subscribe(
      curveAddress,
      'high',
      async (accountInfo, context) => {
        const state = this.parseBondingCurve(accountInfo);
        await this.handleBondingCurveUpdate(curveAddress, state);
      }
    );
  }

  private parseBondingCurve(accountInfo: AccountInfo<Buffer>): BondingCurveState {
    // Pump.fun bonding curve layout
    const data = accountInfo.data;

    const PROGRESS_OFFSET = 8; // After discriminator
    const CURRENT_PRICE_OFFSET = 16;
    const TARGET_POOL_OFFSET = 48;

    const progress = data.readUInt8(PROGRESS_OFFSET);
    const currentPriceBytes = data.slice(CURRENT_PRICE_OFFSET, CURRENT_PRICE_OFFSET + 32);
    const currentPrice = this.readU128(currentPriceBytes);
    const targetPool = new PublicKey(data.slice(TARGET_POOL_OFFSET, TARGET_POOL_OFFSET + 32));

    return {
      address: accountInfo.address.toString(),
      progress: progress / 100, // Convert to 0-1 range
      currentPrice: currentPrice.toString(),
      targetPool: targetPool.toString(),
      targetDex: 'raydium', // Pump.fun migrates to Raydium
      stage: progress >= 100 ? 'migration' : 'bonding',
    };
  }

  private async handleBondingCurveUpdate(
    curveAddress: string,
    state: BondingCurveState
  ) {
    const prevState = this.watchedTokens.get(curveAddress);

    // Emit bonding curve progress event
    const event: MarketEvent = {
      eventId: generateEventId(),
      eventType: 'bonding_curve_progress',
      eventTimestamp: Date.now(),
      slot: 0,
      marketType: 'launchpad',
      marketAddress: curveAddress,
      protocol: 'pumpfun',
      baseMint: '', // Extract from curve account
      quoteMint: 'So11111111111111111111111111111111111111112', // SOL
      data: {
        curveType: 'exponential',
        progress: state.progress * 100,
        currentPrice: state.currentPrice,
        marketCap: this.calculateMarketCap(state),
        holders: 0, // Would need additional fetch
        bondingCurveAddress: curveAddress,
        targetDex: state.targetDex,
        targetPool: state.targetPool,
        stage: state.stage,
      },
      confidence: 0.8, // Medium confidence for bonding curve
      source: 'pumpfun-monitor',
    };

    await this.redis.publish('events:launchpad', JSON.stringify(event));

    // Check for migration completion
    if (state.stage === 'migration' && prevState?.stage !== 'migration') {
      await this.handleMigrationComplete(state);
    }

    this.watchedTokens.set(curveAddress, state);
  }

  private async handleMigrationComplete(state: BondingCurveState) {
    // Emit migration event
    const migrationEvent: MarketEvent = {
      eventId: generateEventId(),
      eventType: 'dex_migration',
      eventTimestamp: Date.now(),
      slot: 0,
      marketType: 'launchpad',
      marketAddress: state.address,
      protocol: 'pumpfun',
      baseMint: '',
      quoteMint: 'So11111111111111111111111111111111111111112',
      data: {
        curveType: 'exponential',
        progress: 100,
        currentPrice: state.currentPrice,
        bondingCurveAddress: state.address,
        targetDex: state.targetDex as MarketProtocol,
        targetPool: state.targetPool,
        stage: 'trading',
      },
      confidence: 1.0,
      source: 'pumpfun-monitor',
    };

    await this.redis.publish('events:launchpad', JSON.stringify(migrationEvent));

    // Notify liquidity-monitor to subscribe to the new DEX pool
    const poolDiscoveredEvent = createPoolDiscoveredEvent({
      poolAddress: state.targetPool,
      dexType: state.targetDex.toUpperCase() as any,
      tokenA: '', // Would need token metadata
      tokenB: 'SOL',
      initialTvl: '0',
      discoveredAt: new Date().toISOString(),
      discoverySource: 'pumpfun-migration',
    });

    await this.redis.publish('events:pools', JSON.stringify(poolDiscoveredEvent));
  }
}
```

---

## 3. SolanaConnectionManager v2 Proposal

### 3.1 Current Architecture Limitations

The current `SolanaConnectionManager` has several limitations for large-scale multi-market monitoring:

1. **Single Connection Per Worker**: Each worker creates one connection instance
2. **No Subscription Management**: Subscriptions are managed at application level
3. **No Connection Pooling**: Cannot distribute subscriptions across multiple connections
4. **No Priority System**: All subscriptions treated equally
5. **Limited Reconnection Logic**: Basic reconnection without subscription restoration

### 3.2 Connection Manager v2 Architecture

```typescript
/**
 * Connection Manager V2 with pooling and smart subscription routing
 */
class SolanaConnectionManagerV2 {
  private pool: ConnectionPool;
  private subscriptionManager: SubscriptionManager;
  private rateLimiter: RateLimiter;
  private healthMonitor: HealthMonitor;

  constructor(config: ConnectionManagerV2Config) {
    this.pool = new ConnectionPool(config);
    this.subscriptionManager = new SubscriptionManager(this.pool);
    this.rateLimiter = new RateLimiter(config.rateLimits);
    this.healthMonitor = new HealthMonitor(this.pool);
  }

  /**
   * Subscribe to account with priority and load balancing
   */
  async subscribeToAccounts(
    accounts: string[],
    options: SubscriptionOptions = {}
  ): Promise<SubscriptionResult[]> {
    const {
      priority = 'normal',
      commitment = 'confirmed',
      onData,
      onError,
    } = options;

    // Optimize subscriptions into batches
    const plan = await this.subscriptionManager.createSubscriptionPlan(
      accounts,
      priority
    );

    const results: SubscriptionResult[] = [];

    for (const batch of plan.batches) {
      const connection = await this.pool.getConnection(batch.connectionId);

      for (const account of batch.accounts) {
        try {
          const subscriptionId = connection.onAccountChange(
            new PublicKey(account),
            onData,
            commitment
          );

          // Track subscription
          this.subscriptionManager.track({
            account,
            subscriptionId,
            connectionId: batch.connectionId,
            priority,
          });

          results.push({
            account,
            subscriptionId,
            status: 'success',
          });
        } catch (error) {
          results.push({
            account,
            subscriptionId: -1,
            status: 'error',
            error: error.message,
          });
        }
      }
    }

    return results;
  }

  /**
   * Subscribe to orderbook market (special handling for Phoenix)
   */
  async subscribeToOrderbook(
    marketAddress: string,
    protocol: MarketProtocol,
    options: OrderbookSubscriptionOptions = {}
  ): Promise<OrderbookSubscription> {
    const subscription = await this.subscribeToAccounts(
      [marketAddress],
      {
        priority: 'high', // Orderbooks are high priority
        onData: options.onData,
      }
    );

    return {
      marketAddress,
      protocol,
      subscriptionId: subscription[0].subscriptionId,
      snapshotOnSubscribe: options.snapshotOnSubscribe ?? true,
      includeSequenceNumbers: true,
    };
  }

  /**
   * Get connection health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const connections = await this.pool.getAllConnections();
    const healthChecks = await Promise.all(
      connections.map(async (conn) => {
        try {
          await conn.getVersion();
          return { connectionId: conn.id, healthy: true };
        } catch {
          return { connectionId: conn.id, healthy: false };
        }
      })
    );

    return {
      totalConnections: connections.length,
      healthyConnections: healthChecks.filter(h => h.healthy).length,
      totalSubscriptions: this.subscriptionManager.getTotalCount(),
      subscriptionsPerConnection: this.subscriptionManager.getCountPerConnection(),
      details: healthChecks,
    };
  }
}

/**
 * Connection pool for managing multiple Solana connections
 */
class ConnectionPool {
  private connections: Map<number, PooledConnection> = new Map();
  private config: ConnectionPoolConfig;

  constructor(config: ConnectionPoolConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    const { maxConnections, rpcUrls, wsUrls } = this.config;

    for (let i = 0; i < maxConnections; i++) {
      const rpcUrl = rpcUrls[i % rpcUrls.length];
      const wsUrl = wsUrls[i % wsUrls.length];

      const connection = new Connection(rpcUrl, {
        commitment: 'confirmed',
        wsEndpoint: wsUrl,
      });

      const pooledConnection: PooledConnection = {
        id: i,
        connection,
        rpcUrl,
        wsUrl,
        subscriptionCount: 0,
        maxSubscriptions: this.config.subscriptionsPerConnection,
        status: 'connecting',
        createdAt: Date.now(),
      };

      this.connections.set(i, pooledConnection);

      // Wait for WebSocket connection
      try {
        await connection.getVersion();
        pooledConnection.status = 'connected';
      } catch (error) {
        pooledConnection.status = 'error';
        console.error(`Failed to connect connection ${i}:`, error);
      }
    }

    // Start health monitoring
    this.startHealthMonitoring();
  }

  async getConnection(id: number): Promise<Connection> {
    const pooled = this.connections.get(id);
    if (!pooled) {
      throw new Error(`Connection ${id} not found`);
    }

    if (pooled.status !== 'connected') {
      throw new Error(`Connection ${id} is not connected (status: ${pooled.status})`);
    }

    if (pooled.subscriptionCount >= pooled.maxSubscriptions) {
      throw new Error(`Connection ${id} has reached max subscriptions (${pooled.maxSubscriptions})`);
    }

    pooled.subscriptionCount++;
    return pooled.connection;
  }

  releaseConnection(id: number): void {
    const pooled = this.connections.get(id);
    if (pooled) {
      pooled.subscriptionCount--;
    }
  }

  private startHealthMonitoring(): void {
    setInterval(async () => {
      for (const [id, conn] of this.connections.entries()) {
        try {
          await conn.connection.getVersion();
          if (conn.status === 'error') {
            conn.status = 'connected';
          }
        } catch {
          conn.status = 'error';
          // Attempt reconnection
          this.reconnect(id);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  private async reconnect(id: number): Promise<void> {
    const conn = this.connections.get(id);
    if (!conn) return;

    try {
      const newConnection = new Connection(conn.rpcUrl, {
        commitment: 'confirmed',
        wsEndpoint: conn.wsUrl,
      });

      await newConnection.getVersion();

      conn.connection = newConnection;
      conn.status = 'connected';
      conn.subscriptionCount = 0;

      // Restore subscriptions
      await this.restoreSubscriptions(id);
    } catch (error) {
      console.error(`Failed to reconnect connection ${id}:`, error);
    }
  }

  private async restoreSubscriptions(connectionId: number): Promise<void> {
    // Subscription restoration logic
    // Would need to track subscriptions and re-subscribe after reconnection
  }

  async getAllConnections(): Promise<Array<{ id: number; status: string }>> {
    return Array.from(this.connections.values()).map(c => ({
      id: c.id,
      status: c.status,
    }));
  }
}

/**
 * Subscription manager with load balancing
 */
class SubscriptionManager {
  private pool: ConnectionPool;
  private subscriptions: Map<string, TrackedSubscription> = new Map();

  constructor(pool: ConnectionPool) {
    this.pool = pool;
  }

  /**
   * Create optimized subscription plan
   */
  async createSubscriptionPlan(
    accounts: string[],
    priority: 'high' | 'normal' | 'low'
  ): Promise<SubscriptionPlan> {
    const connections = await this.pool.getAllConnections();
    const availableConnections = connections.filter(c => c.status === 'connected');

    if (availableConnections.length === 0) {
      throw new Error('No available connections');
    }

    // Group accounts by priority
    const batches: SubscriptionBatch[] = [];

    // For high priority, use least-loaded connection
    if (priority === 'high') {
      const connectionId = this.findLeastLoadedConnection(availableConnections);
      batches.push({
        connectionId,
        accounts,
      });
    } else {
      // Distribute across connections
      const batchSize = Math.ceil(accounts.length / availableConnections.length);
      for (let i = 0; i < accounts.length; i += batchSize) {
        const batchAccounts = accounts.slice(i, i + batchSize);
        const connectionId = availableConnections[
          Math.floor(i / batchSize) % availableConnections.length
        ].id;
        batches.push({
          connectionId: connectionId,
          accounts: batchAccounts,
        });
      }
    }

    return { batches, priority };
  }

  private findLeastLoadedConnection(
    connections: Array<{ id: number; status: string }>
  ): number {
    let leastLoaded = connections[0].id;
    let minCount = Infinity;

    for (const conn of connections) {
      const count = this.getConnectionSubscriptionCount(conn.id);
      if (count < minCount) {
        minCount = count;
        leastLoaded = conn.id;
      }
    }

    return leastLoaded;
  }

  track(sub: TrackedSubscription): void {
    this.subscriptions.set(sub.account, sub);
  }

  untrack(account: string): void {
    this.subscriptions.delete(account);
  }

  getTotalCount(): number {
    return this.subscriptions.size;
  }

  getCountPerConnection(): Map<number, number> {
    const counts = new Map<number, number>();
    for (const sub of this.subscriptions.values()) {
      const current = counts.get(sub.connectionId) || 0;
      counts.set(sub.connectionId, current + 1);
    }
    return counts;
  }

  private getConnectionSubscriptionCount(connectionId: number): number {
    let count = 0;
    for (const sub of this.subscriptions.values()) {
      if (sub.connectionId === connectionId) {
        count++;
      }
    }
    return count;
  }
}

// Type definitions
interface PooledConnection {
  id: number;
  connection: Connection;
  rpcUrl: string;
  wsUrl: string;
  subscriptionCount: number;
  maxSubscriptions: number;
  status: 'connected' | 'connecting' | 'error';
  createdAt: number;
}

interface TrackedSubscription {
  account: string;
  subscriptionId: number;
  connectionId: number;
  priority: 'high' | 'normal' | 'low';
}

interface SubscriptionPlan {
  batches: SubscriptionBatch[];
  priority: 'high' | 'normal' | 'low';
}

interface SubscriptionBatch {
  connectionId: number;
  accounts: string[];
}

interface ConnectionManagerV2Config {
  maxConnections: number;
  subscriptionsPerConnection: number;
  rpcUrls: string[];
  wsUrls: string[];
  rateLimits: { maxRequests: number; windowMs: number };
}

interface SubscriptionOptions {
  priority?: 'high' | 'normal' | 'low';
  commitment?: 'processed' | 'confirmed' | 'finalized';
  onData?: (accountInfo: any, context: any) => void;
  onError?: (error: Error) => void;
}

interface SubscriptionResult {
  account: string;
  subscriptionId: number;
  status: 'success' | 'error';
  error?: string;
}

interface OrderbookSubscriptionOptions extends SubscriptionOptions {
  snapshotOnSubscribe?: boolean;
  includeSequenceNumbers?: boolean;
}

interface OrderbookSubscription {
  marketAddress: string;
  protocol: MarketProtocol;
  subscriptionId: number;
  snapshotOnSubscribe: boolean;
  includeSequenceNumbers: boolean;
}

interface HealthStatus {
  totalConnections: number;
  healthyConnections: number;
  totalSubscriptions: number;
  subscriptionsPerConnection: Map<number, number>;
  details: Array<{ connectionId: number; healthy: boolean }>;
}
```

### 3.3 Subscription Routing Strategy

```typescript
/**
 * Priority-based subscription routing
 */
enum SubscriptionPriority {
  HIGH = 0,    // Orderbook best bids/asks, time-sensitive
  NORMAL = 1,  // AMM pool state changes
  LOW = 2,     // Historical data, analytics
}

/**
 * Connection allocation strategy
 */
class SubscriptionRouter {
  /**
   * Determine optimal connection for subscription
   */
  routeSubscription(
    account: string,
    priority: SubscriptionPriority,
    currentConnections: PooledConnection[]
  ): number {
    // Filter available connections
    const available = currentConnections.filter(
      c => c.status === 'connected' &&
           c.subscriptionCount < c.maxSubscriptions
    );

    if (available.length === 0) {
      throw new Error('No available connections for subscription');
    }

    // For high priority, use connection with most capacity
    if (priority === SubscriptionPriority.HIGH) {
      return available.sort((a, b) =>
        (b.maxSubscriptions - b.subscriptionCount) -
        (a.maxSubscriptions - a.subscriptionCount)
      )[0].id;
    }

    // For normal/low priority, use least loaded connection
    return available.sort((a, b) =>
      a.subscriptionCount - b.subscriptionCount
    )[0].id;
  }

  /**
   * Batch subscriptions for efficiency
   */
  batchSubscriptions(
    accounts: string[],
    priority: SubscriptionPriority,
    connections: PooledConnection[]
  ): Map<number, string[]> {
    const batches = new Map<number, string[]>();

    // Sort accounts by priority
    const sortedAccounts = accounts.sort((a, b) => {
      // Could add logic to prioritize certain accounts
      return 0;
    });

    // Distribute across connections
    const connectionsByLoad = [...connections].sort((a, b) =>
      a.subscriptionCount - b.subscriptionCount
    );

    for (let i = 0; i < sortedAccounts.length; i++) {
      const account = sortedAccounts[i];
      const connIndex = i % connectionsByLoad.length;
      const conn = connectionsByLoad[connIndex];

      if (!batches.has(conn.id)) {
        batches.set(conn.id, []);
      }
      batches.get(conn.id)!.push(account);
    }

    return batches;
  }
}
```

---

## 4. Performance Considerations

### 4.1 Current Limitations & Solutions

| Challenge | Current Limit | Proposed Solution | Expected Improvement |
|-----------|---------------|-------------------|---------------------|
| **WebSocket Subscriptions** | 8,192 accounts/connection | Connection pooling (5x) | 40,960 accounts |
| **Event Processing** | ~1,000 events/sec | Batch processing + worker threads | ~10,000 events/sec |
| **Memory** | ~1KB/subscription | Delta updates + compression | ~200 bytes/subscription |
| **Reconnection Time** | ~5 seconds | Subscription queue + parallel restore | ~1 second |
| **Orderbook Updates** | Full snapshots per update | Delta compression | 90% reduction in data |
| **Price Latency** | ~10 seconds (polling) | WebSocket push events | <100ms |

### 4.2 Memory Optimization Strategies

```typescript
/**
 * Delta compression for orderbook updates
 */
class OrderbookDeltaCompressor {
  /**
   * Calculate delta between two orderbook states
   */
  calculateDelta(
    prev: OrderbookSnapshot,
    curr: OrderbookSnapshot
  ): OrderbookDelta {
    const bidDeltas = this.calculateLevelDeltas(prev.bids, curr.bids);
    const askDeltas = this.calculateLevelDeltas(prev.asks, curr.asks);

    return {
      sequenceNumber: curr.sequenceNumber,
      bidUpdates: bidDeltas,
      askUpdates: askDeltas,
    };
  }

  private calculateLevelDeltas(
    prev: OrderLevel[],
    curr: OrderLevel[]
  ): OrderLevelUpdate[] {
    const updates: OrderLevelUpdate[] = [];
    const prevMap = new Map(prev.map(l => [l.price, l]));

    for (const level of curr) {
      const prevLevel = prevMap.get(level.price);

      if (!prevLevel) {
        // New level inserted
        updates.push({
          price: level.price,
          size: level.size,
          action: 'insert',
        });
      } else if (prevLevel.size !== level.size) {
        // Size updated
        updates.push({
          price: level.price,
          size: level.size,
          action: 'update',
        });
      }
    }

    // Check for deleted levels
    const currMap = new Map(curr.map(l => [l.price, l]));
    for (const level of prev) {
      if (!currMap.has(level.price)) {
        updates.push({
          price: level.price,
          size: '0',
          action: 'delete',
        });
      }
    }

    return updates;
  }

  /**
   * Apply delta to orderbook snapshot
   */
  applyDelta(
    snapshot: OrderbookSnapshot,
    delta: OrderbookDelta
  ): OrderbookSnapshot {
    const newBids = this.applyLevelDeltas(snapshot.bids, delta.bidUpdates);
    const newAsks = this.applyLevelDeltas(snapshot.asks, delta.askUpdates);

    return {
      ...snapshot,
      sequenceNumber: delta.sequenceNumber,
      bids: newBids,
      asks: newAsks,
    };
  }

  private applyLevelDeltas(
    levels: OrderLevel[],
    updates: OrderLevelUpdate[]
  ): OrderLevel[] {
    const result = [...levels];
    const levelMap = new Map(result.map((l, i) => [l.price, i]));

    for (const update of updates) {
      const idx = levelMap.get(update.price);

      if (update.action === 'delete') {
        if (idx !== undefined) {
          result.splice(idx, 1);
        }
      } else if (update.action === 'insert') {
        const newLevel: OrderLevel = {
          price: update.price,
          size: update.size,
          ordersCount: 1,
        };
        result.push(newLevel);
      } else if (update.action === 'update') {
        if (idx !== undefined) {
          result[idx].size = update.size;
        }
      }
    }

    // Maintain sorted order
    return result.sort((a, b) =>
      parseFloat(a.price) - parseFloat(b.price)
    );
  }
}
```

### 4.3 Throughput Optimization

```typescript
/**
 * Batch event processor for high-throughput scenarios
 */
class BatchEventProcessor {
  private eventQueue: MarketEvent[] = [];
  private batchSize = 100;
  private batchTimeout = 50; // ms

  async processEvent(event: MarketEvent): Promise<void> {
    this.eventQueue.push(event);

    if (this.eventQueue.length >= this.batchSize) {
      await this.flushBatch();
    }
  }

  private async flushBatch(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const batch = this.eventQueue.splice(0, this.batchSize);

    // Process batch in parallel
    await Promise.all([
      this.persistBatch(batch),
      this.publishBatch(batch),
      this.updateMetrics(batch),
    ]);
  }

  private async persistBatch(events: MarketEvent[]): Promise<void> {
    // Batch insert to database
    await this.prisma.marketEvent.createMany({
      data: events.map(e => ({
        eventId: e.eventId,
        eventType: e.eventType,
        eventTimestamp: new Date(e.eventTimestamp),
        marketAddress: e.marketAddress,
        marketType: e.marketType,
        protocol: e.protocol,
        data: JSON.stringify(e.data),
      })),
    });
  }

  private async publishBatch(events: MarketEvent[]): Promise<void> {
    // Use Redis pipeline for batch publishing
    const pipeline = this.redis.pipeline();

    for (const event of events) {
      const channel = this.getChannelForEvent(event);
      pipeline.publish(channel, JSON.stringify(event));
    }

    await pipeline.exec();
  }

  private async updateMetrics(events: MarketEvent[]): Promise<void> {
    // Update metrics in Redis
    const metrics = events.reduce((acc, e) => {
      acc[e.marketType] = (acc[e.marketType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    await this.redis.hincrby('metrics:events_by_type', Object.keys(metrics), Object.values(metrics));
  }
}
```

---

## 5. Implementation Roadmap

### Phase 1: Extended Event Schema (Week 1)

**Tasks:**
1. Define unified `MarketEvent` interface in `packages/events/src/`
2. Create discriminated union types for all market event data
3. Add event validators using Zod
4. Implement event normalization utilities
5. Update existing event creators to support new schema

**Deliverables:**
- `packages/events/src/market-events.ts` - New unified event types
- `packages/events/src/normalizers.ts` - Event normalization utilities
- Updated event schemas with backwards compatibility

**Acceptance Criteria:**
- All event types validated with Zod
- Type-safe event data discrimination
- Backwards compatible with existing events

### Phase 2: Connection Pool Implementation (Weeks 2-3)

**Tasks:**
1. Create `ConnectionPool` class in `packages/solana-client/src/`
2. Implement `SubscriptionManager` with load balancing
3. Add health monitoring and auto-reconnection
4. Implement subscription restoration after reconnect
5. Add connection metrics and monitoring

**Deliverables:**
- `packages/solana-client/src/connection-pool.ts`
- `packages/solana-client/src/subscription-manager.ts`
- `packages/solana-client/src/health-monitor.ts`

**Acceptance Criteria:**
- Support for 5+ concurrent connections
- Automatic load balancing across connections
- Health monitoring with automatic reconnection
- Subscription restoration within 1 second

### Phase 3: Phoenix/Orderbook Integration (Weeks 4-5)

**Tasks:**
1. Research Phoenix orderbook account layout
2. Implement `PhoenixOrderbookParser`
3. Add orderbook delta compression
4. Create `OrderbookWatcher` worker module
5. Integrate with enhanced liquidity monitor

**Deliverables:**
- `packages/solana-client/src/parsers/phoenix.ts`
- `workers/orderbook-monitor/` - New worker
- Orderbook delta compression utilities

**Acceptance Criteria:**
- Subscribe to Phoenix markets
- Parse orderbook snapshots and deltas
- Emit `orderbook_snapshot` and `orderbook_updated` events
- Calculate mid-price and spread

### Phase 4: Pump.fun Bonding Curves (Week 6)

**Tasks:**
1. Research Pump.fun program structure
2. Implement `BondingCurveParser`
3. Create `LaunchpadMonitor` worker
4. Add migration detection logic
5. Emit bonding curve progress events

**Deliverables:**
- `packages/solana-client/src/parsers/pumpfun.ts`
- `workers/launchpad-monitor/` - New worker
- Bonding curve event schemas

**Acceptance Criteria:**
- Subscribe to Pump.fun bonding curves
- Track progress from 0% to 100%
- Detect migration to Raydium
- Emit migration events to liquidity monitor

### Phase 5: Performance Testing & Optimization (Week 7)

**Tasks:**
1. Load test with 10,000+ subscriptions
2. Measure event processing throughput
3. Optimize memory usage
4. Test reconnection scenarios
5. Benchmark price latency

**Deliverables:**
- Performance test suite
- Benchmark results
- Optimization recommendations

**Acceptance Criteria:**
- Handle 10,000+ subscriptions
- Process 5,000+ events/second
- <100ms price latency
- <1GB memory for 10K subscriptions

---

## 6. Testing Strategy

### 6.1 Unit Testing

```typescript
/**
 * Example test for orderbook delta compression
 */
describe('OrderbookDeltaCompressor', () => {
  it('should calculate correct delta for new level', () => {
    const prev: OrderbookSnapshot = {
      bids: [{ price: '100', size: '10', ordersCount: 1 }],
      asks: [{ price: '101', size: '5', ordersCount: 1 }],
      // ... other fields
    };

    const curr: OrderbookSnapshot = {
      bids: [
        { price: '100', size: '10', ordersCount: 1 },
        { price: '99', size: '20', ordersCount: 2 },
      ],
      asks: [{ price: '101', size: '5', ordersCount: 1 }],
      // ... other fields
    };

    const compressor = new OrderbookDeltaCompressor();
    const delta = compressor.calculateDelta(prev, curr);

    expect(delta.bidUpdates).toContainEqual({
      price: '99',
      size: '20',
      action: 'insert',
    });
  });
});
```

### 6.2 Integration Testing

```typescript
/**
 * Example integration test for Phoenix market monitoring
 */
describe('PhoenixMarketWatcher', () => {
  it('should subscribe to Phoenix market and receive updates', async () => {
    const watcher = new OrderbookWatcher(connectionPool);
    const events: MarketEvent[] = [];

    await watcher.watchMarket(
      PHOENIX_TEST_MARKET,
      'phoenix',
      {
        onData: (event) => events.push(event),
      }
    );

    // Wait for events
    await sleep(5000);

    expect(events.length).toBeGreaterThan(0);
    expect(events[0].eventType).toBe('orderbook_snapshot');
  });
});
```

### 6.3 Load Testing

```typescript
/**
 * Load test for connection pool
 */
describe('ConnectionPool Load Test', () => {
  it('should handle 10,000 subscriptions', async () => {
    const pool = new ConnectionPool({
      maxConnections: 5,
      subscriptionsPerConnection: 2000,
    });

    await pool.initialize();

    const accounts = generateTestAccounts(10000);
    const results = await pool.subscribeToAccounts(accounts, {
      priority: 'normal',
      onData: () => {},
    });

    const successCount = results.filter(r => r.status === 'success').length;
    expect(successCount).toBe(10000);
  });
});
```

---

## 7. Monitoring & Observability

### 7.1 Key Metrics

```typescript
/**
 * Metrics to track for the enhanced system
 */
interface SystemMetrics {
  // Connection metrics
  connections: {
    total: number;
    active: number;
    error: number;
  };

  // Subscription metrics
  subscriptions: {
    total: number;
    byConnection: Record<number, number>;
    byPriority: {
      high: number;
      normal: number;
      low: number;
    };
  };

  // Event metrics
  events: {
    processed: number;
    perSecond: number;
    byType: Record<string, number>;
    avgProcessingTime: number;
  };

  // Memory metrics
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };

  // Market-specific metrics
  markets: {
    amm: {
      pools: number;
      avgPriceUpdateLatency: number;
    };
    orderbook: {
      markets: number;
      avgUpdateFrequency: number;
      avgSpread: number;
    };
    launchpad: {
      curves: number;
      migrationsDetected: number;
    };
  };
}
```

### 7.2 Health Checks

```typescript
/**
 * Health check endpoint for the enhanced system
 */
class SystemHealthCheck {
  async checkHealth(): Promise<HealthCheckResult> {
    const checks = await Promise.all([
      this.checkConnections(),
      this.checkSubscriptions(),
      this.checkEventProcessing(),
      this.checkMemoryUsage(),
    ]);

    const healthy = checks.every(c => c.healthy);

    return {
      healthy,
      checks,
      timestamp: Date.now(),
    };
  }

  private async checkConnections(): Promise<HealthCheck> {
    const status = await this.connectionManager.getHealthStatus();

    return {
      name: 'connections',
      healthy: status.healthyConnections === status.totalConnections,
      details: status,
    };
  }
}
```

---

## 8. Security Considerations

### 8.1 Input Validation

All incoming events should be validated using Zod schemas before processing:

```typescript
// Validate events before processing
try {
  const validatedEvent = MarketEventSchema.parse(rawEvent);
  await processEvent(validatedEvent);
} catch (error) {
  console.error('Invalid event received:', error);
  // Emit error metric
}
```

### 8.2 Rate Limiting

Implement per-IP and per-API-key rate limiting for public endpoints:

```typescript
const rateLimiter = new RateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 100, // 100 requests per minute
});
```

### 8.3 Data Privacy

- No sensitive user data in events
- Anonymize wallet addresses in logs
- Encrypt sensitive configuration data

---

## 9. Conclusion

The proposed architecture extensions will significantly enhance the Solana EDA system's capability to monitor and trade across multiple market types. The key improvements are:

1. **Unified Event Schema**: Single event interface for AMM, orderbook, and launchpad markets
2. **Connection Pooling**: Support for 10,000+ subscriptions with intelligent load balancing
3. **Real-time Orderbook Monitoring**: Sub-millisecond price discovery from orderbook DEXes
4. **Launchpad Integration**: Early detection of new tokens via bonding curve monitoring
5. **Performance**: 10x improvement in throughput and latency

The implementation roadmap spans 7 weeks, with incremental delivery of functionality. Each phase builds on the previous one, allowing for continuous testing and validation.

---

## Appendix A: Protocol-Specific Details

### A.1 Phoenix Orderbook Format

Phoenix stores orderbook data in a compact binary format:

```
Offset  | Size | Field
--------|------|------------------
0       | 8    | Discriminator
8       | 1    | Market status
9       | 1    | Padding
10      | 8    | Sequence number
18      | 1024 | Bids (128 levels)
1042    | 1024 | Asks (128 levels)
```

Each orderbook level:
```
Offset  | Size | Field
--------|------|------------------
0       | 16   | Price (u128)
16      | 16   | Size (u128)
32      | 8    | Orders count
```

### A.2 OpenBook Orderbook Format

OpenBook uses separate accounts for:
- Market account (metadata)
- Bids account (orderbook bids)
- Asks account (orderbook asks)
- Event queue (trade events)

### A.3 Pump.fun Bonding Curve

Pump.fun uses an exponential bonding curve:
```
price = base_price * (1 + progression) ^ 2

Where:
- base_price = 0.0000125 SOL
- progression = 0 to 1 (0% to 100%)
```

Migration to Raydium occurs at 100% progression.

---

## Appendix B: Redis Channel Structure

```
events:liquidity    - AMM liquidity changes
events:orderbook    - Orderbook snapshots and updates
events:launchpad    - Bonding curve progress
events:price        - Unified price updates
events:trades       - Trade executions
events:markets      - Market discovery events
events:pools        - Pool discovery events
events:tokens       - Token validation events

workers:status      - Worker status updates
commands:trading    - Trading commands
commands:workers    - Worker control commands
```

---

**Document Version:** 1.0
**Last Updated:** 2026-02-09
**Status:** Draft for Review
