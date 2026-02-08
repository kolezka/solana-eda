import Redis from 'ioredis';
import dotenv from 'dotenv';
import { PublicKey } from '@solana/web3.js';
import {
  SolanaConnectionManager,
  TransactionParser,
  ParsedBurnTransaction,
} from '@solana-eda/solana-client';
import { getPrismaClient, BurnEventRepository } from '@solana-eda/database';
import { createBurnEvent, CHANNELS } from '@solana-eda/events';
import { WorkerStatusRepository } from '@solana-eda/database';

dotenv.config();

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const prisma = getPrismaClient();
const burnEventRepo = new BurnEventRepository(prisma);
const workerStatusRepo = new WorkerStatusRepository(prisma);

// Minimum burn threshold - ignore burns below this amount
const MIN_BURN_THRESHOLD = Number(process.env.MIN_BURN_THRESHOLD || '1000000');

// Duplicate prevention window in milliseconds (5 minutes)
const DUPLICATE_WINDOW = 5 * 60 * 1000;

// Track recently processed signatures for deduplication
const recentSignatures = new Map<string, number>();

class BurnDetectorWorker {
  private connection: SolanaConnectionManager;
  private parser: TransactionParser;
  private running = false;
  private workerName = 'burn-detector';
  private subscriptionId: number | null = null;
  private metrics = {
    eventsProcessed: 0,
    errors: 0,
    burnsDetected: 0,
    duplicatesFiltered: 0,
    belowThresholdFiltered: 0,
    startTime: Date.now(),
  };

  constructor() {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const wsUrl = process.env.SOLANA_WS_URL || 'wss://api.mainnet-beta.solana.com';

    this.connection = new SolanaConnectionManager(rpcUrl, wsUrl);
    this.parser = new TransactionParser();

    // Clean up old signatures periodically
    setInterval(() => this.cleanOldSignatures(), 60000);
  }

  async start() {
    console.log(`[BurnDetector] Starting worker...`);
    console.log(`[BurnDetector] Minimum burn threshold: ${MIN_BURN_THRESHOLD}`);
    console.log(`[BurnDetector] RPC URL: ${process.env.SOLANA_RPC_URL || 'mainnet'}`);

    this.running = true;

    await this.updateWorkerStatus('RUNNING');

    // Subscribe to new transactions
    await this.subscribeToTransactions();

    console.log(`[BurnDetector] Worker started successfully`);
  }

  async stop() {
    console.log(`[BurnDetector] Stopping worker...`);
    this.running = false;

    // Remove subscription
    if (this.subscriptionId !== null) {
      const wsConn = this.connection.getWsConnection();
      if (wsConn) {
        wsConn.removeOnLogsListener(this.subscriptionId);
      }
    }

    await this.updateWorkerStatus('STOPPED');
    await redis.quit();
    await this.connection.close();

    console.log(`[BurnDetector] Worker stopped`);
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

    // Publish status to Redis
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

  private async subscribeToTransactions() {
    try {
      const wsConn = this.connection.getWsConnection();
      if (!wsConn) {
        throw new Error('WebSocket connection not available');
      }

      console.log(`[BurnDetector] Subscribing to Token Program logs...`);

      // Subscribe to logs for both Token Program and Token-2022 Program
      const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
      const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

      // Subscribe to Token Program logs
      // Note: onLogs expects a PublicKey, so we subscribe to the Token Program itself
      const tokenProgramPubkey = new PublicKey(TOKEN_PROGRAM);
      this.subscriptionId = wsConn.onLogs(tokenProgramPubkey, async (logs, context) => {
        if (!this.running) return;

        try {
          await this.processLog(logs, context);
        } catch (error) {
          console.error(`[BurnDetector] Error processing log:`, error);
          this.metrics.errors++;
          await this.updateWorkerStatus('RUNNING');
        }
      });

      console.log(`[BurnDetector] Subscribed with ID: ${this.subscriptionId}`);

      // Keep process alive
      await this.keepAlive();
    } catch (error) {
      console.error(`[BurnDetector] Error in subscribeToTransactions:`, error);
      this.metrics.errors++;
      await this.updateWorkerStatus(
        'ERROR',
        error instanceof Error ? error.message : 'Unknown error',
      );

      // Retry after delay with exponential backoff
      const retryDelay = Math.min(5000 * Math.pow(2, this.metrics.errors), 60000);
      console.log(`[BurnDetector] Retrying in ${retryDelay}ms...`);

      setTimeout(() => {
        if (this.running) {
          this.subscribeToTransactions();
        }
      }, retryDelay);
    }
  }

  private async processLog(logs: any, context: any) {
    try {
      const signature = logs.signature;

      // Duplicate check using in-memory cache
      if (recentSignatures.has(signature)) {
        this.metrics.duplicatesFiltered++;
        return;
      }

      // Check if already processed in database
      const existing = await burnEventRepo.findBySignature(signature);
      if (existing) {
        recentSignatures.set(signature, Date.now());
        this.metrics.duplicatesFiltered++;
        return;
      }

      // Add to recent signatures cache
      recentSignatures.set(signature, Date.now());

      // Get transaction details
      const transaction = await this.connection.getTransaction(signature);
      if (!transaction) {
        console.warn(`[BurnDetector] Transaction not found: ${signature}`);
        return;
      }

      // Check transaction error
      if (transaction.meta?.err) {
        console.debug(`[BurnDetector] Transaction failed, skipping: ${signature}`);
        return;
      }

      // Parse for burn
      const burnTx = this.parser.parseBurnTransaction(transaction, signature);
      if (!burnTx) {
        // Not a burn transaction, just return
        return;
      }

      console.log(
        `[BurnDetector] Burn detected: ${burnTx.token.slice(0, 8)}... - ${burnTx.amount}`,
      );

      // Check minimum burn threshold
      if (!this.parser.meetsMinimumThreshold(burnTx, MIN_BURN_THRESHOLD)) {
        console.debug(
          `[BurnDetector] Burn below threshold: ${burnTx.amount} < ${MIN_BURN_THRESHOLD}`,
        );
        this.metrics.belowThresholdFiltered++;
        return;
      }

      // Calculate burn percentage
      const percentage = this.parser.calculateBurnPercentage(burnTx);

      console.log(
        `[BurnDetector] Valid burn: ${burnTx.token.slice(0, 8)}... - ${burnTx.amount} (${percentage.toFixed(4)}%)`,
      );

      // Save to database
      const burnAmount = Number(burnTx.amount);

      await burnEventRepo.create({
        txSignature: burnTx.signature,
        token: burnTx.token,
        amount: burnAmount,
        percentage,
      });

      // Publish event to Redis
      const event = createBurnEvent({
        token: burnTx.token,
        amount: burnTx.amount,
        percentage,
        txSignature: burnTx.signature,
        burner: burnTx.burner,
        preSupply: burnTx.preSupply,
        postSupply: burnTx.postSupply,
      });

      await redis.publish(CHANNELS.EVENTS_BURN, JSON.stringify(event));

      this.metrics.burnsDetected++;
      this.metrics.eventsProcessed++;

      if (this.metrics.eventsProcessed % 10 === 0) {
        await this.updateWorkerStatus('RUNNING');
        console.log(
          `[BurnDetector] Stats: ${this.metrics.burnsDetected} burns, ${this.metrics.duplicatesFiltered} duplicates filtered, ${this.metrics.belowThresholdFiltered} below threshold`,
        );
      }
    } catch (error) {
      console.error(`[BurnDetector] Error processing log:`, error);
      throw error;
    }
  }

  /**
   * Clean up old signatures from the cache
   */
  private cleanOldSignatures() {
    const now = Date.now();
    const cutoff = now - DUPLICATE_WINDOW;

    let cleaned = 0;
    for (const [signature, timestamp] of recentSignatures.entries()) {
      if (timestamp < cutoff) {
        recentSignatures.delete(signature);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.debug(`[BurnDetector] Cleaned ${cleaned} old signatures from cache`);
    }
  }

  private async keepAlive() {
    while (this.running) {
      await new Promise((resolve) => setTimeout(resolve, 60000));

      // Update status periodically
      await this.updateWorkerStatus('RUNNING');
    }
  }
}

// Main execution
async function main() {
  const worker = new BurnDetectorWorker();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n[BurnDetector] Received SIGINT, shutting down...');
    await worker.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n[BurnDetector] Received SIGTERM, shutting down...');
    await worker.stop();
    process.exit(0);
  });

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    console.error('[BurnDetector] Uncaught exception:', error);
    worker.stop().finally(() => process.exit(1));
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('[BurnDetector] Unhandled rejection at:', promise, 'reason:', reason);
  });

  // Start worker
  await worker.start();
}

main().catch((error) => {
  console.error('[BurnDetector] Fatal error:', error);
  process.exit(1);
});
