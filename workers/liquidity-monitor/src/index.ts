import Redis from 'ioredis';
import dotenv from 'dotenv';
import {
  SolanaConnectionManager,
  AccountWatcher,
  PoolParser,
  ParsedPoolData,
} from '@solana-eda/solana-client';
import {
  PrismaClient,
  LiquidityPoolRepository,
  DiscoveredPoolRepository,
} from '@solana-eda/database';
import {
  createLiquidityEvent,
  createPoolDiscoveredEvent,
  CHANNELS,
} from '@solana-eda/events';
import { WorkerStatusRepository } from '@solana-eda/database';
import { PrismaPg } from '@prisma/adapter-pg';

dotenv.config();

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const poolRepo = new LiquidityPoolRepository(prisma);
const discoveredPoolRepo = new DiscoveredPoolRepository(prisma);
const workerStatusRepo = new WorkerStatusRepository(prisma);

// Known liquidity pools to monitor (Raydium, Orca, Meteora)
// Mainnet pools - can be configured via environment
const POOLS_TO_MONITOR = process.env.MONITORED_POOLS
  ? process.env.MONITORED_POOLS.split(',')
  : [
      // === Orca Whirlpools ===
      '7qbRF6YsyGuLUVs6Y1q64bdVrfe4ZcUUz1JRdoVNUJnm', // SOL/USDC
      'HJPjoWUviZJt6qGShA2qtmxH2kDwEuHxdY2uHqxKuWwq', // SOL/USDT
      '7q3KF6H6ds8WvxKqQLtXBwDxVWPt2wJmDPGhkWrGt9Xg', // JUP/SOL

      // === Raydium AMM Pools ===
      '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2', // SOL/USDC
      'DV1fjmLyYkGhNF2Uo5G1gJTrbFZfVNFQ7nYVMfNycMTs', // SOL/USDT
      'FWmaPZQCfA8u2TpXpZCYb9vWfgE7qvnhHEtBodHnRkZr', // RAY/SOL

      // === Raydium CLMM (Concentrated Liquidity) ===
      '3gSjs6MqyHFsp8DXvaKvVUJjV7qg5itf9qmUGuhnSaWH', // USDC/SOL CLMM

      // === Meteora DLMM ===
      '7qbRF6YsyGuLUVs6Y1q64bdVrfe4ZcUUz1JRdoVNUJnm', // Example (replace with actual Meteora pools)
    ];

// Minimum change threshold for emitting events (default 5%)
const CHANGE_THRESHOLD = Number(process.env.CHANGE_THRESHOLD || '5');

// Auto-subscribe to newly discovered markets
const AUTO_SUBSCRIBE_DISCOVERED = process.env.AUTO_SUBSCRIBE_DISCOVERED !== 'false';

interface PoolState {
  address: string;
  dexType: string;
  oldTvl: number;
  newTvl: number;
  oldPrice: number;
  newPrice: number;
  volume24h: number;
  tokenA: string;
  tokenB: string;
  lastUpdate: number;
}

class LiquidityMonitorWorker {
  private connection: SolanaConnectionManager;
  private watcher: AccountWatcher;
  private poolParser: PoolParser;
  private running = false;
  private workerName = 'liquidity-monitor';
  private poolStates: Map<string, PoolState>;
  private historicalStates: Map<string, ParsedPoolData[]>;
  private dynamicPools: Set<string>; // Pools discovered via market events
  private metrics = {
    eventsProcessed: 0,
    errors: 0,
    poolsMonitored: 0,
    dynamicPoolsAdded: 0,
    startTime: Date.now(),
  };

  constructor() {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const wsUrl = process.env.SOLANA_WS_URL || 'wss://api.mainnet-beta.solana.com';

    // Debug logging
    console.log('[LiquidityMonitor] rpcUrl:', rpcUrl);
    console.log('[LiquidityMonitor] rpcUrl type:', typeof rpcUrl);
    console.log('[LiquidityMonitor] rpcUrl length:', rpcUrl?.length);
    console.log('[LiquidityMonitor] rpcUrl starts with http?:', rpcUrl?.startsWith('http'));

    this.connection = new SolanaConnectionManager(rpcUrl);
    this.watcher = new AccountWatcher(this.connection);
    this.poolParser = new PoolParser();
    this.poolStates = new Map();
    this.historicalStates = new Map();
    this.dynamicPools = new Set();
  }

  async start() {
    console.log(`[LiquidityMonitor] Starting worker...`);
    this.running = true;

    await this.updateWorkerStatus('RUNNING');

    // Initialize pool states
    await this.initializePoolStates();

    // Subscribe to pool changes
    await this.subscribeToPools();

    // Subscribe to market discovery events for auto-subscription
    if (AUTO_SUBSCRIBE_DISCOVERED) {
      await this.subscribeToMarketDiscovery();
    }

    console.log(`[LiquidityMonitor] Worker started successfully`);
  }

  async stop() {
    console.log(`[LiquidityMonitor] Stopping worker...`);
    this.running = false;

    this.watcher.unwatchAll();

    // Unsubscribe from market discovery events
    if (AUTO_SUBSCRIBE_DISCOVERED) {
      await redis.unsubscribe(CHANNELS.EVENTS_MARKETS);
    }

    await this.updateWorkerStatus('STOPPED');
    await redis.quit();
    await this.connection.close();

    console.log(`[LiquidityMonitor] Worker stopped`);
  }

  private async updateWorkerStatus(status: 'RUNNING' | 'STOPPED' | 'ERROR', error?: string) {
    const metrics = {
      ...this.metrics,
      uptime: Date.now() - this.metrics.startTime,
    };

    await workerStatusRepo.upsert({
      name: this.workerName,
      status,
      metrics,
    });

    const statusEvent = {
      type: 'WORKER_STATUS',
      timestamp: new Date().toISOString(),
      id: `worker-${this.workerName}-${Date.now()}`,
      data: {
        workerName: this.workerName,
        status,
        metrics,
      },
    };

    await redis.publish(CHANNELS.WORKERS_STATUS, JSON.stringify(statusEvent));
  }

  private async initializePoolStates() {
    console.log(
      `[LiquidityMonitor] Initializing pool states for ${POOLS_TO_MONITOR.length} pools...`,
    );

    for (const poolAddress of POOLS_TO_MONITOR) {
      try {
        // Fetch current pool account data
        const accountInfo = await this.connection.getAccountInfo(
          new (require('@solana/web3.js').PublicKey)(poolAddress),
        );

        if (accountInfo) {
          const parsedPool = this.poolParser.parsePool(
            new (require('@solana/web3.js').PublicKey)(poolAddress),
            accountInfo,
          );

          if (parsedPool) {
            // Get existing pool from database or create new state
            const pool = await poolRepo.findByAddress(poolAddress);

            const state: PoolState = {
              address: poolAddress,
              dexType: parsedPool.dexType,
              oldTvl: pool ? Number(pool.tvl) : parsedPool.tvl,
              newTvl: parsedPool.tvl,
              oldPrice: pool ? Number(pool.price) : parsedPool.price,
              newPrice: parsedPool.price,
              volume24h: pool ? Number(pool.volume24h) : 0,
              tokenA: pool ? pool.tokenA : parsedPool.tokenA.symbol,
              tokenB: pool ? pool.tokenB : parsedPool.tokenB.symbol,
              lastUpdate: Date.now(),
            };

            this.poolStates.set(poolAddress, state);

            // Store initial historical data
            this.historicalStates.set(poolAddress, [parsedPool]);

            // Save to database
            await poolRepo.upsert({
              address: poolAddress,
              tokenA: parsedPool.tokenA.symbol,
              tokenB: parsedPool.tokenB.symbol,
              tvl: parsedPool.tvl,
              price: parsedPool.price,
              volume24h: state.volume24h,
            });

            console.log(
              `[LiquidityMonitor] Initialized pool ${poolAddress}: ${parsedPool.tokenA.symbol}/${parsedPool.tokenB.symbol} ($${parsedPool.tvl.toFixed(2)})`,
            );
            this.metrics.poolsMonitored++;
          } else {
            console.warn(`[LiquidityMonitor] Could not parse pool ${poolAddress}`);
          }
        } else {
          console.warn(`[LiquidityMonitor] Account not found for pool ${poolAddress}`);
        }
      } catch (error) {
        console.error(`[LiquidityMonitor] Error initializing pool ${poolAddress}:`, error);
        this.metrics.errors++;
      }
    }

    console.log(`[LiquidityMonitor] Initialized ${this.metrics.poolsMonitored} pools successfully`);
  }

  private async subscribeToPools() {
    console.log(`[LiquidityMonitor] Subscribing to ${POOLS_TO_MONITOR.length} pools...`);

    for (const poolAddress of POOLS_TO_MONITOR) {
      this.watcher.watchAccount(poolAddress, async (accountInfo, context) => {
        if (!this.running) return;

        try {
          await this.handlePoolChange(poolAddress, accountInfo);
        } catch (error) {
          console.error(`[LiquidityMonitor] Error handling pool change:`, error);
          this.metrics.errors++;
          await this.updateWorkerStatus('RUNNING');
        }
      });

      console.log(`[LiquidityMonitor] Watching pool: ${poolAddress}`);
    }

    // Keep process alive
    await this.keepAlive();
  }

  /**
   * Subscribe to market discovery events for auto-subscription to new pools
   */
  private async subscribeToMarketDiscovery() {
    try {
      console.log(`[LiquidityMonitor] Subscribing to market discovery events...`);

      await redis.subscribe(CHANNELS.EVENTS_MARKETS);

      redis.on('message', (channel, message) => {
        if (channel === CHANNELS.EVENTS_MARKETS && this.running) {
          try {
            const event = JSON.parse(message);
            if (event.type === 'MARKET_DISCOVERED') {
              this.handleMarketDiscovered(event).catch((error) => {
                console.error(`[LiquidityMonitor] Error handling market discovered:`, error);
                this.metrics.errors++;
              });
            }
          } catch (error) {
            console.error(`[LiquidityMonitor] Error parsing market event:`, error);
          }
        }
      });

      console.log(`[LiquidityMonitor] Subscribed to market discovery events`);
    } catch (error) {
      console.error(`[LiquidityMonitor] Error in subscribeToMarketDiscovery:`, error);
      this.metrics.errors++;
    }
  }

  /**
   * Handle market discovered event
   */
  private async handleMarketDiscovered(event: any) {
    try {
      const { data } = event;

      // For OpenBook markets, we need to find the associated pool
      // For Raydium pools, the market address is often the pool address
      const marketAddress = data.marketAddress;
      const dexType = data.dexType;

      console.log(
        `[LiquidityMonitor] Market discovered: ${marketAddress.slice(0, 8)}... (${dexType})`,
      );

      // Check if this is a pool we can monitor
      if (dexType === 'RAYDIUM' || dexType === 'ORCA' || dexType === 'METEORA') {
        // These are direct pool addresses
        await this.addDynamicPool(marketAddress, dexType);
      } else if (dexType === 'OPENBOOK') {
        // OpenBook markets may have associated pools
        // For now, we skip OpenBook as it requires additional lookups
        console.debug(`[LiquidityMonitor] OpenBook market - skipping pool monitoring`);
      }
    } catch (error) {
      console.error(`[LiquidityMonitor] Error handling market discovered:`, error);
    }
  }

  /**
   * Add a dynamically discovered pool to monitoring
   */
  private async addDynamicPool(poolAddress: string, dexType: string) {
    try {
      // Check if already monitoring
      if (this.poolStates.has(poolAddress) || this.dynamicPools.has(poolAddress)) {
        console.debug(`[LiquidityMonitor] Pool ${poolAddress.slice(0, 8)}... already monitored`);
        return;
      }

      console.log(`[LiquidityMonitor] Adding dynamic pool: ${poolAddress.slice(0, 8)}... (${dexType})`);

      // Get pool account info
      const accountInfo = await this.connection.getAccountInfo(
        new (require('@solana/web3.js').PublicKey)(poolAddress),
      );

      if (!accountInfo) {
        console.warn(`[LiquidityMonitor] Could not fetch pool ${poolAddress}`);
        return;
      }

      // Parse pool
      const parsedPool = this.poolParser.parsePool(
        new (require('@solana/web3.js').PublicKey)(poolAddress),
        accountInfo,
      );

      if (!parsedPool) {
        console.warn(`[LiquidityMonitor] Could not parse pool ${poolAddress}`);
        return;
      }

      // Create pool state
      const state: PoolState = {
        address: poolAddress,
        dexType: parsedPool.dexType,
        oldTvl: parsedPool.tvl,
        newTvl: parsedPool.tvl,
        oldPrice: parsedPool.price,
        newPrice: parsedPool.price,
        volume24h: 0,
        tokenA: parsedPool.tokenA.symbol,
        tokenB: parsedPool.tokenB.symbol,
        lastUpdate: Date.now(),
      };

      this.poolStates.set(poolAddress, state);
      this.historicalStates.set(poolAddress, [parsedPool]);
      this.dynamicPools.add(poolAddress);

      // Save to database as discovered pool
      await discoveredPoolRepo.create({
        address: poolAddress,
        dexType: parsedPool.dexType as any,
        tokenA: parsedPool.tokenA.symbol,
        tokenB: parsedPool.tokenB.symbol,
        initialTvl: parsedPool.tvl,
        status: 'MONITORING',
      });

      // Publish pool discovered event
      const event = createPoolDiscoveredEvent({
        poolAddress,
        dexType: parsedPool.dexType as any,
        tokenA: parsedPool.tokenA.symbol,
        tokenB: parsedPool.tokenB.symbol,
        initialTvl: parsedPool.tvl.toString(),
        discoveredAt: new Date().toISOString(),
        discoverySource: 'market-detector',
        poolData: {
          lpMint: undefined, // Would need additional parsing
          feeRate: parsedPool.feeRate,
        },
      });

      await redis.publish(CHANNELS.EVENTS_POOLS, JSON.stringify(event));

      // Subscribe to pool changes
      this.watcher.watchAccount(poolAddress, async (accountInfo, context) => {
        if (!this.running) return;

        try {
          await this.handlePoolChange(poolAddress, accountInfo);
        } catch (error) {
          console.error(`[LiquidityMonitor] Error handling pool change:`, error);
          this.metrics.errors++;
          await this.updateWorkerStatus('RUNNING');
        }
      });

      this.metrics.dynamicPoolsAdded++;
      this.metrics.poolsMonitored++;

      console.log(
        `[LiquidityMonitor] Now monitoring ${poolAddress.slice(0, 8)}... (${parsedPool.tokenA.symbol}/${parsedPool.tokenB.symbol})`,
      );
    } catch (error) {
      console.error(`[LiquidityMonitor] Error adding dynamic pool:`, error);
      this.metrics.errors++;
    }
  }

  private async handlePoolChange(poolAddress: string, accountInfo: any) {
    try {
      const currentState = this.poolStates.get(poolAddress);
      if (!currentState) return;

      // Parse pool data using real parser
      const parsedPool = this.poolParser.parsePool(
        new (require('@solana/web3.js').PublicKey)(poolAddress),
        accountInfo,
      );

      if (!parsedPool) {
        console.warn(`[LiquidityMonitor] Could not parse updated pool ${poolAddress}`);
        return;
      }

      // Calculate change percentages
      const tvlChangePercent =
        currentState.oldTvl > 0
          ? ((parsedPool.tvl - currentState.oldTvl) / currentState.oldTvl) * 100
          : 0;

      const priceChangePercent =
        currentState.oldPrice > 0
          ? ((parsedPool.price - currentState.oldPrice) / currentState.oldPrice) * 100
          : 0;

      // Update state
      currentState.oldTvl = currentState.newTvl;
      currentState.newTvl = parsedPool.tvl;
      currentState.oldPrice = currentState.newPrice;
      currentState.newPrice = parsedPool.price;
      currentState.lastUpdate = Date.now();

      // Store historical data (keep last 100 states)
      const history = this.historicalStates.get(poolAddress) || [];
      history.push(parsedPool);
      if (history.length > 100) {
        history.shift();
      }
      this.historicalStates.set(poolAddress, history);

      // Save to database
      await poolRepo.upsert({
        address: poolAddress,
        tokenA: parsedPool.tokenA.symbol,
        tokenB: parsedPool.tokenB.symbol,
        tvl: parsedPool.tvl,
        price: parsedPool.price,
        volume24h: currentState.volume24h,
      });

      // Emit event if significant change
      if (Math.abs(tvlChangePercent) >= CHANGE_THRESHOLD) {
        console.log(
          `[LiquidityMonitor] Significant liquidity change for ${poolAddress}: ${tvlChangePercent.toFixed(2)}%`,
        );

        const event = createLiquidityEvent({
          poolAddress,
          tokenA: parsedPool.tokenA.symbol,
          tokenB: parsedPool.tokenB.symbol,
          oldTvl: currentState.oldTvl.toString(),
          newTvl: parsedPool.tvl.toString(),
          price: parsedPool.price.toString(),
          changePercentage: tvlChangePercent,
        });

        await redis.publish(CHANNELS.EVENTS_LIQUIDITY, JSON.stringify(event));

        this.metrics.eventsProcessed++;
      }

      // Update status periodically
      if (this.metrics.eventsProcessed % 10 === 0) {
        await this.updateWorkerStatus('RUNNING');
      }
    } catch (error) {
      console.error(`[LiquidityMonitor] Error in handlePoolChange:`, error);
      throw error;
    }
  }

  private async keepAlive() {
    while (this.running) {
      await new Promise((resolve) => setTimeout(resolve, 60000));

      // Periodic pool state refresh to catch any missed updates
      await this.refreshPoolStates();

      // Update status
      await this.updateWorkerStatus('RUNNING');
    }
  }

  private async refreshPoolStates() {
    console.log(`[LiquidityMonitor] Refreshing pool states...`);

    for (const poolAddress of POOLS_TO_MONITOR) {
      try {
        const accountInfo = await this.connection.getAccountInfo(
          new (require('@solana/web3.js').PublicKey)(poolAddress),
        );

        if (accountInfo) {
          await this.handlePoolChange(poolAddress, accountInfo);
        }
      } catch (error) {
        console.error(`[LiquidityMonitor] Error refreshing pool ${poolAddress}:`, error);
      }
    }
  }
}

// Main execution
async function main() {
  const worker = new LiquidityMonitorWorker();

  process.on('SIGINT', async () => {
    console.log('\n[LiquidityMonitor] Received SIGINT, shutting down...');
    await worker.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n[LiquidityMonitor] Received SIGTERM, shutting down...');
    await worker.stop();
    process.exit(0);
  });

  await worker.start();
}

main().catch((error) => {
  console.error('[LiquidityMonitor] Fatal error:', error);
  process.exit(1);
});
