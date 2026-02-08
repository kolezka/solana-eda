import Redis from 'ioredis';
import dotenv from 'dotenv';
import { SolanaConnectionManager, AccountWatcher, PoolParser, ParsedPoolData } from '@solana-eda/solana-client';
import { getPrismaClient, LiquidityPoolRepository } from '@solana-eda/database';
import { createLiquidityEvent, CHANNELS } from '@solana-eda/events';
import { WorkerStatusRepository } from '@solana-eda/database';

dotenv.config();

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const prisma = getPrismaClient();
const poolRepo = new LiquidityPoolRepository(prisma);
const workerStatusRepo = new WorkerStatusRepository(prisma);

// Known liquidity pools to monitor (Raydium, Orca, Meteora)
// Mainnet pools - can be configured via environment
const POOLS_TO_MONITOR = process.env.MONITORED_POOLS
  ? process.env.MONITORED_POOLS.split(',')
  : [
      // Orca SOL/USDC Whirlpool
      '7qbRF6YsyGuLUVs6Y1q64bdVrfe4ZcUUz1JRdoVNUJnm',
      // Raydium SOL/USDC pool
      '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2',
    ];

// Minimum change threshold for emitting events (default 5%)
const CHANGE_THRESHOLD = Number(process.env.CHANGE_THRESHOLD || '5');

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
  private metrics = {
    eventsProcessed: 0,
    errors: 0,
    poolsMonitored: 0,
    startTime: Date.now(),
  };

  constructor() {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const wsUrl = process.env.SOLANA_WS_URL || 'wss://api.mainnet-beta.solana.com';

    this.connection = new SolanaConnectionManager(rpcUrl, wsUrl);
    this.watcher = new AccountWatcher(this.connection);
    this.poolParser = new PoolParser();
    this.poolStates = new Map();
    this.historicalStates = new Map();
  }

  async start() {
    console.log(`[LiquidityMonitor] Starting worker...`);
    this.running = true;

    await this.updateWorkerStatus('RUNNING');

    // Initialize pool states
    await this.initializePoolStates();

    // Subscribe to pool changes
    await this.subscribeToPools();

    console.log(`[LiquidityMonitor] Worker started successfully`);
  }

  async stop() {
    console.log(`[LiquidityMonitor] Stopping worker...`);
    this.running = false;

    this.watcher.unwatchAll();
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
    console.log(`[LiquidityMonitor] Initializing pool states for ${POOLS_TO_MONITOR.length} pools...`);

    for (const poolAddress of POOLS_TO_MONITOR) {
      try {
        // Fetch current pool account data
        const accountInfo = await this.connection.getAccountInfo(new (require('@solana/web3.js')).PublicKey(poolAddress));

        if (accountInfo) {
          const parsedPool = this.poolParser.parsePool(
            new (require('@solana/web3.js')).PublicKey(poolAddress),
            accountInfo
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

            console.log(`[LiquidityMonitor] Initialized pool ${poolAddress}: ${parsedPool.tokenA.symbol}/${parsedPool.tokenB.symbol} ($${parsedPool.tvl.toFixed(2)})`);
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

  private async handlePoolChange(poolAddress: string, accountInfo: any) {
    try {
      const currentState = this.poolStates.get(poolAddress);
      if (!currentState) return;

      // Parse pool data using real parser
      const parsedPool = this.poolParser.parsePool(
        new (require('@solana/web3.js')).PublicKey(poolAddress),
        accountInfo
      );

      if (!parsedPool) {
        console.warn(`[LiquidityMonitor] Could not parse updated pool ${poolAddress}`);
        return;
      }

      // Calculate change percentages
      const tvlChangePercent = currentState.oldTvl > 0
        ? ((parsedPool.tvl - currentState.oldTvl) / currentState.oldTvl) * 100
        : 0;

      const priceChangePercent = currentState.oldPrice > 0
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
        console.log(`[LiquidityMonitor] Significant liquidity change for ${poolAddress}: ${tvlChangePercent.toFixed(2)}%`);

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
      await new Promise(resolve => setTimeout(resolve, 60000));

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
          new (require('@solana/web3.js')).PublicKey(poolAddress)
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
