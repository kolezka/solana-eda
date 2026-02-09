import Redis from 'ioredis';
import dotenv from 'dotenv';
import { PublicKey } from '@solana/web3.js';
import {
  SolanaConnectionManager,
  MarketParser,
  MarketDEXType,
  OPENBOOK_V2_PROGRAM_ID,
  OPENBOOK_V1_PROGRAM_ID,
  WSOL_MINT,
  USDC_MINT,
  USDT_MINT,
} from '@solana-eda/solana-client';
import { PrismaClient, MarketRepository } from '@solana-eda/database';
import { createMarketDiscoveredEvent, CHANNELS } from '@solana-eda/events';
import { WorkerStatusRepository } from '@solana-eda/database';
import { PrismaPg } from '@prisma/adapter-pg';

dotenv.config();

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const marketRepo = new MarketRepository(prisma);
const workerStatusRepo = new WorkerStatusRepository(prisma);

// Quote mints to track (can be configured via environment)
const QUOTE_MINTS = process.env.QUOTE_MINTS
  ? process.env.QUOTE_MINTS.split(',')
  : [WSOL_MINT, USDC_MINT, USDT_MINT];

// Minimum pool size to consider (default: 1 SOL)
const MIN_POOL_SIZE = Number(process.env.MIN_POOL_SIZE || '1000000000');

// Duplicate prevention window in milliseconds (1 hour)
const DUPLICATE_WINDOW = 60 * 60 * 1000;

// Track recently discovered markets for deduplication
const recentMarkets = new Map<string, number>();

class MarketDetectorWorker {
  private connection: SolanaConnectionManager;
  private marketParser: MarketParser;
  private running = false;
  private workerName = 'market-detector';
  private openBookSubscriptionId: number | null = null;
  private metrics = {
    eventsProcessed: 0,
    errors: 0,
    marketsDiscovered: 0,
    duplicatesFiltered: 0,
    belowThresholdFiltered: 0,
    startTime: Date.now(),
  };

  constructor() {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const wsUrl = process.env.SOLANA_WS_URL || 'wss://api.mainnet-beta.solana.com';

    console.log(`[MarketDetector] Initializing with RPC: ${rpcUrl}`);
    console.log(`[MarketDetector] Tracking quote mints: ${QUOTE_MINTS.join(', ')}`);
    console.log(`[MarketDetector] Minimum pool size: ${MIN_POOL_SIZE} lamports`);

    this.connection = new SolanaConnectionManager(rpcUrl);
    this.marketParser = new MarketParser();

    // Clean up old markets periodically
    setInterval(() => this.cleanOldMarkets(), 300000); // Every 5 minutes
  }

  async start() {
    console.log(`[MarketDetector] Starting worker...`);
    this.running = true;

    await this.updateWorkerStatus('RUNNING');

    // Subscribe to OpenBook market creation events
    await this.subscribeToOpenBookMarkets();

    // Subscribe to program logs for new market creation
    await this.subscribeToProgramLogs();

    console.log(`[MarketDetector] Worker started successfully`);
  }

  async stop() {
    console.log(`[MarketDetector] Stopping worker...`);
    this.running = false;

    // Remove subscriptions
    if (this.openBookSubscriptionId !== null) {
      const wsConn = this.connection.getWsConnection();
      if (wsConn) {
        wsConn.removeOnLogsListener(this.openBookSubscriptionId);
      }
    }

    await this.updateWorkerStatus('STOPPED');
    await redis.quit();
    await this.connection.close();

    console.log(`[MarketDetector] Worker stopped`);
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

  /**
   * Subscribe to OpenBook market creation via program logs
   * This monitors for InitializeMarket instructions
   */
  private async subscribeToOpenBookMarkets() {
    try {
      const wsConn = this.connection.getWsConnection();
      if (!wsConn) {
        throw new Error('WebSocket connection not available');
      }

      console.log(`[MarketDetector] Subscribing to OpenBook V2 market creation...`);

      // Subscribe to OpenBook V2 program logs
      const openBookV2Pubkey = new PublicKey(OPENBOOK_V2_PROGRAM_ID);
      this.openBookSubscriptionId = wsConn.onLogs(
        openBookV2Pubkey,
        async (logs, context) => {
          if (!this.running) return;

          try {
            await this.processOpenBookLogs(logs, context);
          } catch (error) {
            console.error(`[MarketDetector] Error processing OpenBook logs:`, error);
            this.metrics.errors++;
          }
        },
      );

      console.log(`[MarketDetector] Subscribed to OpenBook V2 with ID: ${this.openBookSubscriptionId}`);
    } catch (error) {
      console.error(`[MarketDetector] Error in subscribeToOpenBookMarkets:`, error);
      this.metrics.errors++;
    }
  }

  /**
   * Subscribe to program logs for generic market discovery
   */
  private async subscribeToProgramLogs() {
    try {
      const wsConn = this.connection.getWsConnection();
      if (!wsConn) {
        return; // WebSocket not available, skip
      }

      console.log(`[MarketDetector] Subscribing to program logs for market discovery...`);

      // Monitor Raydium AMM for new pools
      const raydiumAmmPubkey = new PublicKey('675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');

      wsConn.onLogs(raydiumAmmPubkey, async (logs, context) => {
        if (!this.running) return;

        try {
          await this.processRaydiumLogs(logs, context);
        } catch (error) {
          console.error(`[MarketDetector] Error processing Raydium logs:`, error);
          this.metrics.errors++;
        }
      });

      console.log(`[MarketDetector] Subscribed to Raydium AMM logs`);
    } catch (error) {
      console.error(`[MarketDetector] Error in subscribeToProgramLogs:`, error);
      this.metrics.errors++;
    }
  }

  /**
   * Process OpenBook logs for new market creation
   */
  private async processOpenBookLogs(logs: any, context: any) {
    try {
      const signature = logs.signature;

      // Duplicate check
      if (recentMarkets.has(signature)) {
        this.metrics.duplicatesFiltered++;
        return;
      }

      // Check if already processed
      const existing = await marketRepo.findByAddress(signature);
      if (existing) {
        recentMarkets.set(signature, Date.now());
        this.metrics.duplicatesFiltered++;
        return;
      }

      // Add to recent markets
      recentMarkets.set(signature, Date.now());

      // Look for market initialization in logs
      const logString = logs.logs?.join(' ') || '';
      if (logString.includes('InitializeMarket') || logString.includes('init_market')) {
        console.log(`[MarketDetector] Potential new market detected in transaction: ${signature}`);

        // Get transaction details to find the new market address
        const transaction = await this.connection.getTransaction(signature);
        if (!transaction) {
          return;
        }

        // Parse transaction to find market account
        const marketAddress = await this.extractMarketAddressFromTransaction(transaction);
        if (marketAddress) {
          await this.handleNewMarket(marketAddress, 'OPENBOOK', signature);
        }
      }
    } catch (error) {
      console.error(`[MarketDetector] Error processing OpenBook logs:`, error);
    }
  }

  /**
   * Process Raydium logs for new pool creation
   */
  private async processRaydiumLogs(logs: any, context: any) {
    try {
      const signature = logs.signature;

      // Duplicate check
      if (recentMarkets.has(signature)) {
        this.metrics.duplicatesFiltered++;
        return;
      }

      recentMarkets.set(signature, Date.now());

      // Look for pool initialization in logs
      const logString = logs.logs?.join(' ') || '';
      if (logString.includes('InitializePool') || logString.includes('init_pool')) {
        console.log(`[MarketDetector] Potential new Raydium pool detected: ${signature}`);

        // Get transaction details
        const transaction = await this.connection.getTransaction(signature);
        if (!transaction) {
          return;
        }

        // Parse transaction to find pool address
        const poolAddress = await this.extractPoolAddressFromTransaction(transaction);
        if (poolAddress) {
          await this.handleNewMarket(poolAddress, 'RAYDIUM', signature);
        }
      }
    } catch (error) {
      console.error(`[MarketDetector] Error processing Raydium logs:`, error);
    }
  }

  /**
   * Extract market address from transaction
   */
  private async extractMarketAddressFromTransaction(transaction: any): Promise<string | null> {
    try {
      // Look for newly created accounts owned by OpenBook
      const accountKeys = transaction.transaction?.message?.accountKeys || [];
      const postBalances = transaction.meta?.postBalances || [];
      const preBalances = transaction.meta?.preBalances || [];

      for (let i = 0; i < accountKeys.length; i++) {
        // Look for accounts that were created (balance changed from 0 to non-zero)
        // In production, you'd check the account owner
        if (preBalances[i] === 0 && postBalances[i] > 0) {
          const address = accountKeys[i];
          // Verify it's a market account by fetching its info
          try {
            const accountInfo = await this.connection.getAccountInfo(new PublicKey(address));
            if (accountInfo && this.marketParser.detectMarketDEXType(accountInfo.owner) === MarketDEXType.OPENBOOK) {
              return address;
            }
          } catch {
            // Account might not exist yet or be inaccessible
            continue;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('[MarketDetector] Error extracting market address:', error);
      return null;
    }
  }

  /**
   * Extract pool address from transaction
   */
  private async extractPoolAddressFromTransaction(transaction: any): Promise<string | null> {
    try {
      // Similar logic to extractMarketAddressFromTransaction
      // but for Raydium pools
      const accountKeys = transaction.transaction?.message?.accountKeys || [];
      const postBalances = transaction.meta?.postBalances || [];
      const preBalances = transaction.meta?.preBalances || [];

      for (let i = 0; i < accountKeys.length; i++) {
        if (preBalances[i] === 0 && postBalances[i] > 0) {
          const address = accountKeys[i];
          try {
            const accountInfo = await this.connection.getAccountInfo(new PublicKey(address));
            if (accountInfo && this.marketParser.detectMarketDEXType(accountInfo.owner) === MarketDEXType.RAYDIUM) {
              return address;
            }
          } catch {
            continue;
          }
        }
      }

      return null;
    } catch (error) {
      console.error('[MarketDetector] Error extracting pool address:', error);
      return null;
    }
  }

  /**
   * Handle newly discovered market/pool
   */
  private async handleNewMarket(
    address: string,
    dexType: 'OPENBOOK' | 'RAYDIUM' | 'ORCA' | 'METEORA',
    signature: string,
  ) {
    try {
      // Fetch market account info
      const accountInfo = await this.connection.getAccountInfo(new PublicKey(address));
      if (!accountInfo) {
        console.warn(`[MarketDetector] Could not fetch account info for ${address}`);
        return;
      }

      // Parse market data
      const marketData = this.marketParser.parseMarket(new PublicKey(address), accountInfo);
      if (!marketData) {
        console.warn(`[MarketDetector] Could not parse market ${address}`);
        return;
      }

      // Check if quote mint is one we're tracking
      if (!this.marketParser.isKnownQuoteMint(marketData.quoteMint)) {
        console.debug(
          `[MarketDetector] Skipping market with unknown quote mint: ${marketData.quoteMint}`,
        );
        this.metrics.belowThresholdFiltered++;
        return;
      }

      // Check minimum pool size (simplified - would need vault balances)
      // For now, we'll accept all markets with known quote mints

      console.log(
        `[MarketDetector] New market discovered: ${address} (${dexType}) - ${marketData.baseMint}/${marketData.quoteMint}`,
      );

      // Save to database
      await marketRepo.create({
        address,
        baseMint: marketData.baseMint,
        quoteMint: marketData.quoteMint,
        dexType,
        marketData: marketData.marketData,
      });

      // Publish event
      const event = createMarketDiscoveredEvent({
        marketAddress: address,
        baseMint: marketData.baseMint,
        quoteMint: marketData.quoteMint,
        dexType,
        discoveredAt: new Date().toISOString(),
        source: signature,
        marketData: marketData.marketData,
      });

      await redis.publish(CHANNELS.EVENTS_MARKETS, JSON.stringify(event));

      this.metrics.marketsDiscovered++;
      this.metrics.eventsProcessed++;

      // Update status periodically
      if (this.metrics.eventsProcessed % 10 === 0) {
        await this.updateWorkerStatus('RUNNING');
        console.log(
          `[MarketDetector] Stats: ${this.metrics.marketsDiscovered} markets discovered, ${this.metrics.duplicatesFiltered} duplicates filtered`,
        );
      }
    } catch (error) {
      console.error(`[MarketDetector] Error handling new market:`, error);
      this.metrics.errors++;
    }
  }

  /**
   * Clean up old markets from cache
   */
  private cleanOldMarkets() {
    const now = Date.now();
    const cutoff = now - DUPLICATE_WINDOW;

    let cleaned = 0;
    for (const [signature, timestamp] of recentMarkets.entries()) {
      if (timestamp < cutoff) {
        recentMarkets.delete(signature);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.debug(`[MarketDetector] Cleaned ${cleaned} old markets from cache`);
    }
  }

  /**
   * Keep alive loop
   */
  async keepAlive() {
    while (this.running) {
      await new Promise((resolve) => setTimeout(resolve, 60000));
      await this.updateWorkerStatus('RUNNING');
    }
  }
}

// Main execution
async function main() {
  const worker = new MarketDetectorWorker();

  process.on('SIGINT', async () => {
    console.log('\n[MarketDetector] Received SIGINT, shutting down...');
    await worker.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n[MarketDetector] Received SIGTERM, shutting down...');
    await worker.stop();
    process.exit(0);
  });

  process.on('uncaughtException', (error) => {
    console.error('[MarketDetector] Uncaught exception:', error);
    worker.stop().finally(() => process.exit(1));
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('[MarketDetector] Unhandled rejection at:', promise, 'reason:', reason);
  });

  await worker.start();
  await worker.keepAlive();
}

main().catch((error) => {
  console.error('[MarketDetector] Fatal error:', error);
  process.exit(1);
});
