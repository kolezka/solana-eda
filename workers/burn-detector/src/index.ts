import Redis from 'ioredis';
import dotenv from 'dotenv';
import { PublicKey } from '@solana/web3.js';
import {
  SolanaConnectionManager,
  SidecarConnection,
  TransactionParser,
  TokenValidator,
} from '@solana-eda/solana-client';
import type { ParsedBurnTransaction } from '@solana-eda/solana-client';
import { PrismaClient, BurnEventRepository, TokenValidationRepository } from '@solana-eda/database';
import { createBurnEvent, createTokenValidatedEvent, CHANNELS, FeatureFlags } from '@solana-eda/events';
import { WorkerStatusRepository } from '@solana-eda/database';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  RabbitMQConnection,
  initWorkerRabbitMQ,
  publishWorkerEvent,
  closeWorkerRabbitMQ,
} from '@solana-eda/rabbitmq';

dotenv.config();

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

const burnEventRepo = new BurnEventRepository(prisma);
const tokenValidationRepo = new TokenValidationRepository(prisma);
const workerStatusRepo = new WorkerStatusRepository(prisma);

// Minimum burn threshold - ignore burns below this amount
const MIN_BURN_THRESHOLD = Number(process.env.MIN_BURN_THRESHOLD || '1000000');

// Validation settings
const CHECK_IF_MINT_IS_RENOUNCED = process.env.CHECK_IF_MINT_IS_RENOUNCED === 'true';
const CHECK_IF_IS_LOCKED = process.env.CHECK_IF_IS_LOCKED === 'true';
const MIN_LP_BURN_THRESHOLD = Number(process.env.MIN_LP_BURN_THRESHOLD || '100');

// Duplicate prevention window in milliseconds (5 minutes)
const DUPLICATE_WINDOW = 5 * 60 * 1000;

// Track recently processed signatures for deduplication
const recentSignatures = new Map<string, number>();

// Track tokens that have been validated recently (1 hour cache)
const recentlyValidatedTokens = new Map<string, number>();

class BurnDetectorWorker {
  private connection: SolanaConnectionManager | SidecarConnection;
  private parser: TransactionParser;
  private tokenValidator: TokenValidator;
  private running = false;
  private workerName = 'burn-detector';
  private subscriptionId: number | null = null;
  private marketSubscriptionId: number | null = null;
  private useSidecar: boolean = false;

  // RabbitMQ properties
  private rabbitMQConnection: RabbitMQConnection | null = null;
  private rabbitMQEnabled = false;
  private dualWriteEnabled = false;

  private metrics = {
    eventsProcessed: 0,
    errors: 0,
    burnsDetected: 0,
    duplicatesFiltered: 0,
    belowThresholdFiltered: 0,
    tokensValidated: 0,
    startTime: Date.now(),
    // RabbitMQ metrics
    rabbitMQPublishSuccess: 0,
    rabbitMQPublishFailure: 0,
    // Sidecar metrics
    sidecarConnected: false,
  };

  constructor() {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const wsUrl = process.env.SOLANA_WS_URL || 'wss://api.mainnet-beta.solana.com';
    this.useSidecar = process.env.USE_SIDECAR === 'true';

    console.log({ rpcUrl, wsUrl, useSidecar: this.useSidecar });

    if (this.useSidecar) {
      this.connection = new SidecarConnection();
      console.log('[BurnDetector] Using RPC Sidecar for connection');
    } else {
      this.connection = new SolanaConnectionManager({ rpcUrl, wsUrl });
      console.log('[BurnDetector] Using direct Solana connection');
    }

    this.parser = new TransactionParser();
    this.tokenValidator = new TokenValidator();

    // Clean up old signatures periodically
    setInterval(() => this.cleanOldSignatures(), 60000);
    // Clean up validated tokens periodically
    setInterval(() => this.cleanOldValidations(), 300000); // Every 5 minutes
  }

  /**
   * Initialize RabbitMQ connection for event publishing
   */
  private async initializeRabbitMQ() {
    // Check feature flags
    this.rabbitMQEnabled = FeatureFlags.isRabbitMQEnabled();
    this.dualWriteEnabled = FeatureFlags.isDualWriteEnabled();

    if (!this.rabbitMQEnabled) {
      console.log('[BurnDetector] RabbitMQ publishing disabled');
      return;
    }

    try {
      console.log('[BurnDetector] Initializing RabbitMQ connection...');
      this.rabbitMQConnection = await initWorkerRabbitMQ({
        url: FeatureFlags.getRabbitMQUrl(),
        exchangeName: 'solana.events',
        enablePublisherConfirms: true,
      });
      console.log('[BurnDetector] RabbitMQ connection established');
    } catch (error) {
      console.error('[BurnDetector] Failed to connect to RabbitMQ:', error);
      this.rabbitMQEnabled = false;
      this.rabbitMQConnection = null;
    }
  }

  async start() {
    console.log(`[BurnDetector] Starting worker...`);
    console.log(`[BurnDetector] Minimum burn threshold: ${MIN_BURN_THRESHOLD}`);
    console.log(`[BurnDetector] RPC URL: ${process.env.SOLANA_RPC_URL || 'mainnet'}`);

    // Log feature flags configuration
    FeatureFlags.logConfiguration(this.workerName);

    // Initialize RabbitMQ
    await this.initializeRabbitMQ();

    // Connect to sidecar if enabled
    if (this.useSidecar && this.connection instanceof SidecarConnection) {
      try {
        await this.connection.connect();
        this.metrics.sidecarConnected = true;
        console.log('[BurnDetector] Connected to RPC Sidecar');
      } catch (error) {
        console.error('[BurnDetector] Failed to connect to RPC Sidecar:', error);
        throw error;
      }
    }

    this.running = true;

    await this.updateWorkerStatus('RUNNING');

    // Subscribe to new transactions
    await this.subscribeToTransactions();

    // Subscribe to market discovery events for token validation
    await this.subscribeToMarketEvents();

    console.log(`[BurnDetector] Worker started successfully`);
  }

  async stop() {
    console.log(`[BurnDetector] Stopping worker...`);
    this.running = false;

    // Close RabbitMQ connection
    if (this.rabbitMQConnection) {
      try {
        await closeWorkerRabbitMQ(this.rabbitMQConnection);
        console.log('[BurnDetector] RabbitMQ connection closed');
      } catch (error) {
        console.error('[BurnDetector] Error closing RabbitMQ:', error);
      }
      this.rabbitMQConnection = null;
    }

    // Remove subscriptions
    if (this.subscriptionId !== null) {
      if (this.connection instanceof SidecarConnection) {
        this.connection.removeOnLogsListener(this.subscriptionId);
      } else {
        const wsConn = this.connection.getWsConnection();
        if (wsConn) {
          wsConn.removeOnLogsListener(this.subscriptionId);
        }
      }
    }

    // Unsubscribe from Redis channels
    await redis.unsubscribe(CHANNELS.EVENTS_MARKETS);

    await this.updateWorkerStatus('STOPPED');
    await redis.quit();

    // Close connection (works for both SolanaConnectionManager and SidecarConnection)
    if (this.connection instanceof SidecarConnection) {
      await this.connection.close();
    } else {
      await this.connection.close();
    }

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

    // Publish to Redis (always)
    await redis.publish(CHANNELS.WORKERS_STATUS, JSON.stringify(statusEvent));

    // Also publish to RabbitMQ if enabled
    if (this.rabbitMQEnabled && this.rabbitMQConnection) {
      try {
        await publishWorkerEvent(
          this.rabbitMQConnection,
          'WORKER_STATUS',
          statusEvent.data,
          {
            routingKey: `worker.${this.workerName}.${status.toLowerCase()}`,
            source: 'burn-detector',
            correlationId: statusEvent.id,
          }
        );
        this.metrics.rabbitMQPublishSuccess++;
      } catch (error) {
        console.error('[BurnDetector] RabbitMQ status publish failed:', error);
        this.metrics.rabbitMQPublishFailure++;
      }
    }
  }

  private async subscribeToTransactions() {
    try {
      if (this.connection instanceof SidecarConnection) {
        // Use sidecar connection directly
        console.log(`[BurnDetector] Subscribing to Token Program logs via Sidecar...`);

        const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

        this.subscriptionId = await this.connection.onLogs(
          TOKEN_PROGRAM,
          async (logs, context) => {
            if (!this.running) return;

            try {
              await this.processLog(logs, context);
            } catch (error) {
              console.error(`[BurnDetector] Error processing log:`, error);
              this.metrics.errors++;
              await this.updateWorkerStatus('RUNNING');
            }
          }
        );

        console.log(`[BurnDetector] Subscribed with ID: ${this.subscriptionId}`);
      } else {
        // Use direct connection
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
      }

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

  /**
   * Subscribe to market discovery events for token validation
   */
  private async subscribeToMarketEvents() {
    try {
      console.log(`[BurnDetector] Subscribing to market discovery events...`);

      // Subscribe to market discovery channel
      await redis.subscribe(CHANNELS.EVENTS_MARKETS);

      // Handle incoming messages
      redis.on('message', (channel, message) => {
        if (channel === CHANNELS.EVENTS_MARKETS && this.running) {
          try {
            const event = JSON.parse(message);
            if (event.type === 'MARKET_DISCOVERED') {
              this.handleMarketDiscovered(event).catch((error) => {
                console.error(`[BurnDetector] Error handling market discovered:`, error);
                this.metrics.errors++;
              });
            }
          } catch (error) {
            console.error(`[BurnDetector] Error parsing market event:`, error);
          }
        }
      });

      console.log(`[BurnDetector] Subscribed to market discovery events`);
    } catch (error) {
      console.error(`[BurnDetector] Error in subscribeToMarketEvents:`, error);
      this.metrics.errors++;
    }
  }

  /**
   * Handle market discovered event
   */
  private async handleMarketDiscovered(event: any) {
    try {
      const { data } = event;
      const tokenMint = data.baseMint;

      console.log(`[BurnDetector] Market discovered for token: ${tokenMint.slice(0, 8)}...`);

      // Check if we've validated this token recently
      if (recentlyValidatedTokens.has(tokenMint)) {
        console.debug(
          `[BurnDetector] Token ${tokenMint.slice(0, 8)}... validated recently, skipping`,
        );
        return;
      }

      // Perform token validation
      await this.validateToken(tokenMint);
    } catch (error) {
      console.error(`[BurnDetector] Error handling market discovered:`, error);
    }
  }

  /**
   * Validate a token mint
   */
  private async validateToken(tokenMint: string) {
    try {
      console.log(`[BurnDetector] Validating token: ${tokenMint.slice(0, 8)}...`);

      // Get mint account info
      const mintAccountInfo = await this.connection.getAccountInfo(new PublicKey(tokenMint));
      if (!mintAccountInfo) {
        console.warn(`[BurnDetector] Could not fetch mint account for ${tokenMint}`);
        return;
      }

      // Parse mint data
      const mintData = this.tokenValidator.parseMintAccount(tokenMint, mintAccountInfo);

      // Check if renounced
      const isRenounced = CHECK_IF_MINT_IS_RENOUNCED
        ? this.tokenValidator.checkMintable(mintData)
        : undefined;

      // Check if supply is burned
      const supplyCheck = this.tokenValidator.checkSupplyBurned(mintData);
      const isBurned = supplyCheck.isBurned;

      // Check lock status (if enabled)
      const isLocked = CHECK_IF_IS_LOCKED ? false : undefined; // Would need pool state

      // Calculate confidence
      const confidence = this.tokenValidator.calculateConfidence(
        isRenounced ?? false,
        isBurned,
        false, // LP tokens burned - would need pool data
        isLocked ?? false,
      );

      const validatedAt = new Date();
      const validationData = {
        token: tokenMint,
        isRenounced,
        isBurned,
        isLocked,
        lpBurnedCount: 0,
        confidence,
        validatedAt,
        validationDetails: {
          mintAuthorityRenounced: isRenounced ?? false,
          supplyBurned: isBurned,
          supplyBurnedPercent: supplyCheck.burnedPercent,
          lpTokensBurned: false,
          liquidityLocked: isLocked ?? false,
        },
      };

      // Save to database
      await tokenValidationRepo.create(validationData);

      // Publish validation event
      const event = createTokenValidatedEvent({
        ...validationData,
        validatedAt: validatedAt.toISOString(),
      });

      // Publish to Redis (always)
      await redis.publish(CHANNELS.EVENTS_TOKENS, JSON.stringify(event));

      // Also publish to RabbitMQ if enabled
      if (this.rabbitMQEnabled && this.rabbitMQConnection) {
        try {
          await publishWorkerEvent(
            this.rabbitMQConnection,
            'TOKEN_VALIDATED',
            event.data,
            {
              routingKey: 'token.validated',
              source: 'burn-detector',
              correlationId: event.id,
            }
          );
          this.metrics.rabbitMQPublishSuccess++;
        } catch (error) {
          console.error('[BurnDetector] RabbitMQ publish failed:', error);
          this.metrics.rabbitMQPublishFailure++;
        }
      }

      // Mark as validated
      recentlyValidatedTokens.set(tokenMint, Date.now());

      this.metrics.tokensValidated++;

      console.log(
        `[BurnDetector] Token validated: ${tokenMint.slice(0, 8)}... - Confidence: ${confidence.toFixed(2)}`,
      );

      // Update status periodically
      if (this.metrics.tokensValidated % 10 === 0) {
        await this.updateWorkerStatus('RUNNING');
        console.log(`[BurnDetector] Validated ${this.metrics.tokensValidated} tokens`);
      }
    } catch (error) {
      console.error(`[BurnDetector] Error validating token ${tokenMint}:`, error);
      this.metrics.errors++;
    }
  }

  /**
   * Clean up old validated tokens from cache
   */
  private cleanOldValidations() {
    const now = Date.now();
    const cutoff = now - 60 * 60 * 1000; // 1 hour

    let cleaned = 0;
    for (const [token, timestamp] of recentlyValidatedTokens.entries()) {
      if (timestamp < cutoff) {
        recentlyValidatedTokens.delete(token);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.debug(`[BurnDetector] Cleaned ${cleaned} old validations from cache`);
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

      // Publish to Redis (always)
      await redis.publish(CHANNELS.EVENTS_BURN, JSON.stringify(event));

      // Also publish to RabbitMQ if enabled
      if (this.rabbitMQEnabled && this.rabbitMQConnection) {
        try {
          await publishWorkerEvent(
            this.rabbitMQConnection,
            'BURN_DETECTED',
            event.data,
            {
              routingKey: 'burn.detected',
              source: 'burn-detector',
              correlationId: event.id,
            }
          );
          this.metrics.rabbitMQPublishSuccess++;
        } catch (error) {
          console.error('[BurnDetector] RabbitMQ publish failed:', error);
          this.metrics.rabbitMQPublishFailure++;
          // Continue with Redis success
        }
      }

      this.metrics.burnsDetected++;
      this.metrics.eventsProcessed++;

      if (this.metrics.eventsProcessed % 10 === 0) {
        await this.updateWorkerStatus('RUNNING');
        console.log(
          `[BurnDetector] Stats: ${this.metrics.burnsDetected} burns, ${this.metrics.duplicatesFiltered} duplicates filtered, ${this.metrics.belowThresholdFiltered} below threshold, ${this.metrics.tokensValidated} tokens validated`,
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
