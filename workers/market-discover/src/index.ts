/**
 * Market Discover Worker
 * Discovers new markets on OpenBook and other DEXes on Solana
 * Publishes MARKET_DISCOVERED events to BullMQ
 */

import Redis from 'ioredis';
import { PrismaClient } from '@solana-eda/database';
import {
  createMarketDiscoveredEvent,
  EventDeduplicator,
} from '@solana-eda/events';
import { addEventToQueue } from '@solana-eda/queue';
import type { MarketDiscoveredEvent } from '@solana-eda/types';
import { OpenBookClient, type OpenBookMarketState } from './openbook-client.js';
import { config } from './config.js';
import { retryWithBackoff, CircuitBreaker } from '@solana-eda/error-handling';

interface MarketDiscoverMetrics {
  marketsDiscovered: number;
  duplicatesSkipped: number;
  errors: number;
  startTime: Date;
}

class MarketDiscoverWorker {
  private prisma: PrismaClient;
  private redis: Redis;
  private openBookClient: OpenBookClient;
  private deduplicator: EventDeduplicator;
  private circuitBreaker: CircuitBreaker;
  private metrics: MarketDiscoverMetrics;
  private running = false;
  private pollTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.prisma = new (PrismaClient as any)();
    this.redis = new Redis(config.redisUrl);
    this.openBookClient = new OpenBookClient(config.solanaRpcUrl);
    this.deduplicator = new EventDeduplicator({
      redis: this.redis,
      windowMs: config.deduplicationWindowMs,
      enableMetrics: true,
    });
    this.circuitBreaker = new CircuitBreaker({});
    this.metrics = {
      marketsDiscovered: 0,
      duplicatesSkipped: 0,
      errors: 0,
      startTime: new Date(),
    };
  }

  /**
   * Handle discovered market
   */
  private async handleMarketDiscovered(marketState: OpenBookMarketState): Promise<void> {
    try {
      // Check if market already exists in database
      const existing = await this.prisma.marketRecord.findUnique({
        where: { address: marketState.marketKey },
      });

      if (existing) {
        this.metrics.duplicatesSkipped++;
        return;
      }

      // Check deduplication
      const event = createMarketDiscoveredEvent({
        marketAddress: marketState.marketKey,
        baseMint: marketState.baseMint,
        quoteMint: marketState.quoteMint,
        dexType: 'OPENBOOK',
        discoveredAt: new Date().toISOString(),
        source: config.workerName,
        marketData: marketState.marketData,
      });

      const deduplicationResult = await this.deduplicator.check(event);
      if (deduplicationResult.isDuplicate) {
        this.metrics.duplicatesSkipped++;
        console.log(`Duplicate market discovered: ${marketState.marketKey}`);
        return;
      }

      // Add event to queue
      await addEventToQueue(event);
      this.metrics.marketsDiscovered++;
      console.log(`Market discovered: ${marketState.marketKey} (${marketState.baseMint}/${marketState.quoteMint})`);

      // Store in database
      await this.prisma.marketRecord.create({
        data: {
          address: marketState.marketKey,
          baseMint: marketState.baseMint,
          quoteMint: marketState.quoteMint,
          dexType: 'OPENBOOK',
          discoveredAt: new Date(),
          status: 'DISCOVERED',
          marketData: marketState.marketData,
        },
      });

    } catch (error) {
      this.metrics.errors++;
      console.error(`Error handling discovered market ${marketState.marketKey}:`, error);
      throw error;
    }
  }

  /**
   * Run market discovery
   */
  private async runDiscovery(): Promise<void> {
    try {
      await this.circuitBreaker.execute(async () => {
        await retryWithBackoff(
          async () => {
            await this.openBookClient.discoverMarkets(
              config.quoteMints,
              async (market) => {
                await this.handleMarketDiscovered(market);
              },
            );
          },
          {
            maxAttempts: 3,
            baseDelay: 1000,
            onRetry: (attempt: number, error: Error, delay: number) => {
              console.log(`Discovery attempt ${attempt} failed, retrying in ${delay.toFixed(0)}ms...`, error.message);
            },
          },
        );
      });
    } catch (error) {
      this.metrics.errors++;
      console.error('Market discovery failed:', error);
    }
  }

  /**
   * Publish worker status
   */
  private async publishStatus(status: 'RUNNING' | 'STOPPED' | 'ERROR'): Promise<void> {
    const uptime = Math.floor((Date.now() - this.metrics.startTime.getTime()) / 1000);

    const statusEvent = {
      type: 'WORKER_STATUS' as const,
      timestamp: new Date().toISOString(),
      id: `${config.workerName}-status-${Date.now()}`,
      data: {
        workerName: config.workerName,
        status,
        metrics: {
          eventsProcessed: this.metrics.marketsDiscovered,
          errors: this.metrics.errors,
          uptime,
          lastEventAt: new Date().toISOString(),
        },
      },
    };

    await addEventToQueue(statusEvent);
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    if (this.running) {
      console.log('Worker is already running');
      return;
    }

    this.running = true;
    this.metrics.startTime = new Date();

    console.log(`Starting ${config.workerName} worker...`);
    console.log(`RPC URL: ${config.solanaRpcUrl}`);
    console.log(`Quote mints: ${config.quoteMints.join(', ')}`);
    console.log(`Discovery interval: ${config.discoveryIntervalMs}ms`);

    // Publish initial status
    await this.publishStatus('RUNNING');

    // Run initial discovery
    await this.runDiscovery();

    // Set up polling interval
    this.pollTimer = setInterval(async () => {
      if (this.running) {
        await this.runDiscovery();
        await this.publishStatus('RUNNING');
      }
    }, config.discoveryIntervalMs);

    console.log(`${config.workerName} worker started`);
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    if (!this.running) {
      console.log('Worker is not running');
      return;
    }

    console.log(`Stopping ${config.workerName} worker...`);
    this.running = false;

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    await this.publishStatus('STOPPED');
    await this.redis.quit();
    await this.openBookClient.close();

    console.log(`${config.workerName} worker stopped`);
  }

  /**
   * Get current metrics
   */
  getMetrics(): MarketDiscoverMetrics & { uptime: number } {
    return {
      ...this.metrics,
      uptime: Math.floor((Date.now() - this.metrics.startTime.getTime()) / 1000),
    };
  }

  /**
   * Get deduplication metrics
   */
  getDeduplicationMetrics() {
    return this.deduplicator.getMetrics();
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const worker = new MarketDiscoverWorker();

  // Handle graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`Received ${signal}, shutting down gracefully...`);
    await worker.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGUSR2', () => shutdown('SIGUSR2')); // nodemon

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    shutdown('UNCAUGHT_EXCEPTION').catch(() => process.exit(1));
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
    shutdown('UNHANDLED_REJECTION').catch(() => process.exit(1));
  });

  // Start the worker
  await worker.start();

  // Keep the process alive
  console.log('Worker is running. Press Ctrl+C to stop.');
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Failed to start worker:', error);
    process.exit(1);
  });
}

export { MarketDiscoverWorker, main };
