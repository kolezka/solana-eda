import { Connection, PublicKey } from '@solana/web3.js';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import { CHANNELS, createPriceUpdateEvent, createWorkerStatusEvent, FeatureFlags } from '@solana-eda/events';
import { PriceRepository, WorkerStatusRepository } from '@solana-eda/database';
import { SolanaConnectionManager, SidecarConnection, createRpcPoolFromEnv, type ConnectionType } from '@solana-eda/solana-client';
import { Keypair } from '@solana/web3.js';
import { getLogger, LogLevel } from '@solana-eda/monitoring';
import {
  RabbitMQConnection,
  initWorkerRabbitMQ,
  publishWorkerEvent,
  closeWorkerRabbitMQ,
} from '@solana-eda/rabbitmq';

// Load environment variables
dotenv.config();

const logger = getLogger('price-aggregator');

// Configuration
const TRACKED_TOKENS = process.env.TRACKED_TOKENS
  ? process.env.TRACKED_TOKENS.split(',').map((t) => t.trim())
  : [
      'So11111111111111111111111111111111111111112', // SOL
      'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    ];

const PRICE_POLL_INTERVAL = parseInt(process.env.PRICE_POLL_INTERVAL || '10000', 10);
const WORKER_NAME = process.env.WORKER_NAME || 'price-aggregator';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/solana_eda';
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const SOLANA_WS_URL = process.env.SOLANA_WS_URL;

// Get private key from environment
const PRIVATE_KEY_BYTES = Buffer.from(
  (process.env.TRADING_PRIVATE_KEY || '').replace(/0x/, ''),
  'base64',
);

interface DEXPriceSource {
  dex: string;
  price: number;
  volume24h?: number;
}

interface TokenPrice {
  token: string;
  price: number;
  sources: DEXPriceSource[];
  confidence: number;
  volume24h?: number;
  priceChange24h?: number;
}

class PriceAggregatorWorker {
  private connection: SolanaConnectionManager | SidecarConnection;
  private redis: Redis;
  private priceRepository: PriceRepository;
  private workerStatusRepository: WorkerStatusRepository;
  private isRunning = false;
  private pollInterval?: NodeJS.Timeout;
  private priceHistory: Map<string, number[]> = new Map();
  private healthCheckInterval?: NodeJS.Timeout;
  private useSidecar: boolean = false;
  private useRpcPool: boolean = false;
  private lastPoolStats?: Map<string, Array<{
    url: string;
    healthy: boolean;
    averageLatency: number;
    totalRequests: number;
    failedRequests: number;
    consecutiveErrors: number;
  }>> = undefined;

  // RabbitMQ properties
  private rabbitMQConnection: RabbitMQConnection | null = null;
  private rabbitMQEnabled = false;
  private dualWriteEnabled = false;

  private metrics = {
    pricesUpdated: 0,
    errors: 0,
    tokensTracked: TRACKED_TOKENS.length,
    lastPollAt: '',
    // RabbitMQ metrics
    rabbitMQPublishSuccess: 0,
    rabbitMQPublishFailure: 0,
    // Sidecar metrics
    sidecarConnected: false,
  };

  constructor() {
    this.useSidecar = process.env.USE_SIDECAR === 'true';

    if (this.useSidecar) {
      this.connection = new SidecarConnection();
      console.log('[PriceAggregator] Using RPC Sidecar for connection');
    } else {
      // Fallback to existing pooling logic
      const rpcUrls = process.env.SOLANA_RPC_URLS?.split(',') || [];
      this.useRpcPool = rpcUrls.length > 1 || !!process.env.SOLANA_RPC_URLS?.includes(',');

      this.connection = new SolanaConnectionManager({
        rpcUrl: SOLANA_RPC_URL,
        wsUrl: SOLANA_WS_URL,
        usePool: this.useRpcPool, // Enable pooling if multiple URLs detected
      });

      if (this.useRpcPool) {
        console.log('[PriceAggregator] RPC connection pooling enabled');
        console.log(`[PriceAggregator] Using ${rpcUrls.length} RPC endpoints`);
      }
    }

    // Initialize Redis
    this.redis = new Redis(REDIS_URL);

    // Initialize repositories (they'll create their own PrismaClient)
    // We're using a simplified approach here - in production you'd use dependency injection
    // @ts-ignore - We'll handle the Prisma initialization
    this.priceRepository = new PriceRepository({ prisma: null });
    // @ts-ignore
    this.workerStatusRepository = new WorkerStatusRepository({ prisma: null });
  }

  /**
   * Initialize RabbitMQ connection for event publishing
   */
  private async initializeRabbitMQ() {
    // Check feature flags
    this.rabbitMQEnabled = FeatureFlags.isRabbitMQEnabled();
    this.dualWriteEnabled = FeatureFlags.isDualWriteEnabled();

    if (!this.rabbitMQEnabled) {
      console.log('[PriceAggregator] RabbitMQ publishing disabled');
      return;
    }

    try {
      console.log('[PriceAggregator] Initializing RabbitMQ connection...');
      this.rabbitMQConnection = await initWorkerRabbitMQ({
        url: FeatureFlags.getRabbitMQUrl(),
        exchangeName: 'solana.events',
        enablePublisherConfirms: true,
      });
      console.log('[PriceAggregator] RabbitMQ connection established');
    } catch (error) {
      console.error('[PriceAggregator] Failed to connect to RabbitMQ:', error);
      this.rabbitMQEnabled = false;
      this.rabbitMQConnection = null;
    }
  }

  async start(): Promise<void> {
    logger.info('Starting Price Aggregator Worker...');

    // Log feature flags configuration
    FeatureFlags.logConfiguration('price-aggregator');

    // Initialize RabbitMQ
    await this.initializeRabbitMQ();

    // Connect to sidecar if enabled
    if (this.useSidecar && this.connection instanceof SidecarConnection) {
      try {
        await this.connection.connect();
        this.metrics.sidecarConnected = true;
        logger.info('Connected to RPC Sidecar');
      } catch (error) {
        logger.error('Failed to connect to RPC Sidecar:', error as Error);
        throw error;
      }
    }

    this.isRunning = true;

    // Publish initial status
    await this.publishWorkerStatus();

    // Start polling
    this.pollInterval = setInterval(() => this.pollPrices(), PRICE_POLL_INTERVAL);

    // Do initial poll
    await this.pollPrices();

    logger.info(`Price Aggregator Worker started. Tracking ${TRACKED_TOKENS.length} tokens.`);
    logger.info(`Polling interval: ${PRICE_POLL_INTERVAL}ms`);
    logger.info(`RPC Sidecar: ${this.useSidecar ? 'ENABLED' : 'DISABLED'}`);
  }

  async stop(): Promise<void> {
    logger.info('Stopping Price Aggregator Worker...');
    this.isRunning = false;

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Close RabbitMQ connection
    if (this.rabbitMQConnection) {
      try {
        await closeWorkerRabbitMQ(this.rabbitMQConnection);
        console.log('[PriceAggregator] RabbitMQ connection closed');
      } catch (error) {
        console.error('[PriceAggregator] Error closing RabbitMQ:', error);
      }
      this.rabbitMQConnection = null;
    }

    // Publish final status
    await this.publishWorkerStatus();

    await this.redis.quit();

    // Close connection (works for both SolanaConnectionManager and SidecarConnection)
    if (this.connection instanceof SidecarConnection) {
      await this.connection.close();
    } else {
      await this.connection.close();
    }

    logger.info('Price Aggregator Worker stopped.');
  }

  /**
   * Collect RPC pool statistics for monitoring
   */
  private async collectPoolStats(): Promise<void> {
    if (!this.useRpcPool) return;

    try {
      const healthStatus = await this.connection.getHealthStatus();

      // Type guard: check if this is SolanaConnectionManager health status
      if ('poolingEnabled' in healthStatus && healthStatus.poolingEnabled && healthStatus.poolStats) {
        this.lastPoolStats = healthStatus.poolStats;

        // Log pool health
        for (const [poolType, endpoints] of healthStatus.poolStats) {
          for (const endpoint of endpoints) {
            if (!endpoint.healthy) {
              console.warn(
                `[PriceAggregator] RPC endpoint unhealthy: ${endpoint.url} (${poolType}) - ` +
                `errors: ${endpoint.consecutiveErrors}, avg latency: ${endpoint.averageLatency}ms`
              );
            }
          }
        }
      }
    } catch (error) {
      console.error('[PriceAggregator] Error collecting pool stats:', error);
    }
  }

  private async pollPrices(): Promise<void> {
    if (!this.isRunning) return;

    try {
      logger.debug(`Polling prices for ${TRACKED_TOKENS.length} tokens...`);

      // Fetch prices from all DEXes for all tracked tokens
      const tokenPrices: TokenPrice[] = [];

      for (const tokenMint of TRACKED_TOKENS) {
        try {
          const priceData = await this.fetchTokenPrice(tokenMint);
          if (priceData) {
            tokenPrices.push(priceData);
          }
        } catch (error) {
          logger.error(`Error fetching price for ${tokenMint}:`, error as Error);
          this.metrics.errors++;
        }
      }

      // Process and save prices
      for (const priceData of tokenPrices) {
        await this.processPriceUpdate(priceData);
      }

      this.metrics.lastPollAt = new Date().toISOString();
      this.metrics.pricesUpdated += tokenPrices.length;

      logger.debug(`Price poll complete. Updated ${tokenPrices.length} token prices.`);

      // Publish updated status
      await this.publishWorkerStatus();
    } catch (error) {
      logger.error('Error during price polling:', error as Error);
      this.metrics.errors++;
    }
  }

  private async fetchTokenPrice(tokenMint: string): Promise<TokenPrice | null> {
    // For now, we'll use a simplified price fetch from Jupiter API
    // In production, you'd query multiple DEXes via the DEXAggregator

    try {
      const SOL_MINT = 'So11111111111111111111111111111111111111112';
      const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

      // Define trading pairs
      let inputMint: string;
      let outputMint: string;
      let isBaseToken = false;

      if (tokenMint === SOL_MINT) {
        // Get SOL price in USDC
        inputMint = SOL_MINT;
        outputMint = USDC_MINT;
        isBaseToken = true;
      } else if (tokenMint === USDC_MINT) {
        // USDC is always $1
        return {
          token: tokenMint,
          price: 1.0,
          sources: [{ dex: 'stablecoin', price: 1.0 }],
          confidence: 1.0,
          volume24h: 0,
        };
      } else {
        // Get token price in SOL, then convert to USD
        inputMint = tokenMint;
        outputMint = SOL_MINT;
      }

      // Use Jupiter API for price quotes
      const amount = '1000000'; // 1 token (assuming 6 or 9 decimals)
      const apiUrl = 'https://quote-api.jup.ag/v6';
      const url = `${apiUrl}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=50`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Jupiter API error: ${response.status}`);
      }

      const quote = (await response.json()) as { outAmount?: string; inAmount?: string };

      if (!quote.outAmount || !quote.inAmount) {
        throw new Error('Invalid quote response from Jupiter API');
      }

      const rawPrice = Number(quote.outAmount) / Number(quote.inAmount);

      // If we got SOL/token price, invert to get token/SOL price
      let priceInSol = rawPrice;
      if (inputMint === tokenMint && outputMint === SOL_MINT) {
        priceInSol = rawPrice;
      } else {
        priceInSol = 1 / rawPrice;
      }

      // For non-SOL tokens, we'd need to multiply by SOL price to get USD
      // For now, we'll just return the price we got
      let finalPrice = priceInSol;

      // Store price history for 24h change calculation
      const now = Date.now();
      const history = this.priceHistory.get(tokenMint) || [];
      history.push(finalPrice);

      // Keep only last 24 hours of prices (assuming 10s interval, that's 8640 data points)
      // For simplicity, we'll keep last 100 data points
      if (history.length > 100) {
        history.shift();
      }
      this.priceHistory.set(tokenMint, history);

      // Calculate 24h price change (simplified - using available history)
      let priceChange24h: number | undefined;
      if (history.length > 10) {
        const oldPrice = history[0];
        if (oldPrice !== undefined) {
          priceChange24h = ((finalPrice - oldPrice) / oldPrice) * 100;
        }
      }

      return {
        token: tokenMint,
        price: finalPrice,
        sources: [
          {
            dex: 'jupiter',
            price: finalPrice,
            volume24h: 0, // Would need to fetch from DEX
          },
        ],
        confidence: 0.9, // High confidence from Jupiter aggregator
        priceChange24h,
      };
    } catch (error) {
      logger.error(`Error fetching price for ${tokenMint}:`, error as Error);
      return null;
    }
  }

  private async processPriceUpdate(priceData: TokenPrice): Promise<void> {
    try {
      // Calculate VWAP across sources
      const totalVolume = priceData.sources.reduce((sum, s) => sum + (s.volume24h || 0), 0);

      let vwap = priceData.price;
      if (totalVolume > 0) {
        vwap =
          priceData.sources.reduce((sum, s) => sum + s.price * (s.volume24h || 0), 0) / totalVolume;
      }

      // Assign confidence score based on source count and price spread
      const prices = priceData.sources.map((s) => s.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const spread = maxPrice > 0 ? (maxPrice - minPrice) / maxPrice : 0;

      // Higher confidence with more sources and lower spread
      const sourceCount = priceData.sources.length;
      const confidence = Math.min(1.0, (sourceCount / 4) * (1 - spread));

      const finalPriceData = {
        ...priceData,
        price: vwap,
        confidence,
      };

      // Save to database
      try {
        await this.priceRepository.create({
          token: priceData.token,
          price: vwap,
          source: 'aggregated',
          confidence,
          volume24h: totalVolume,
        });
      } catch (dbError) {
        // Database might not be available, log and continue
        logger.warn('Failed to save price to database', { error: dbError });
      }

      // Publish price update event
      const event = createPriceUpdateEvent({
        token: priceData.token,
        price: vwap.toString(),
        source: 'aggregated',
        confidence,
        volume24h: totalVolume?.toString(),
        priceChange24h: priceData.priceChange24h,
        sources: priceData.sources.map((s) => ({
          dex: s.dex,
          price: s.price.toString(),
          volume24h: s.volume24h?.toString(),
        })),
      });

      // Publish to Redis (always)
      await this.redis.publish(CHANNELS.EVENTS_PRICE, JSON.stringify(event));

      // Also publish to RabbitMQ if enabled
      if (this.rabbitMQEnabled && this.rabbitMQConnection) {
        try {
          await publishWorkerEvent(
            this.rabbitMQConnection,
            'PRICE_UPDATE',
            event.data,
            {
              routingKey: 'price.updated',
              source: 'price-aggregator',
              correlationId: event.id,
            }
          );
          this.metrics.rabbitMQPublishSuccess++;
        } catch (error) {
          console.error('[PriceAggregator] RabbitMQ publish failed:', error);
          this.metrics.rabbitMQPublishFailure++;
        }
      }

      logger.debug(
        `Price updated: ${priceData.token} = $${vwap.toFixed(6)} (confidence: ${(confidence * 100).toFixed(1)}%)`,
      );
    } catch (error) {
      logger.error('Error processing price update:', error as Error);
      throw error;
    }
  }

  private async publishWorkerStatus(): Promise<void> {
    try {
      const uptime = process.uptime();

      // Build metrics object
      const metrics: any = {
        eventsProcessed: this.metrics.pricesUpdated,
        errors: this.metrics.errors,
        uptime,
        lastEventAt: this.metrics.lastPollAt,
      };

      // Add RPC pool metrics if enabled
      if (this.useRpcPool && this.lastPoolStats) {
        metrics.rpcPoolEnabled = true;
        metrics.rpcPoolStats = {};

        for (const [poolType, endpoints] of this.lastPoolStats) {
          const healthyCount = endpoints.filter((e: any) => e.healthy).length;
          const totalCount = endpoints.length;

          metrics.rpcPoolStats[poolType] = {
            healthy: `${healthyCount}/${totalCount}`,
            endpoints: endpoints.map((e: any) => ({
              url: e.url.replace(/\/\/.*@/, '//***@'), // Hide auth
              healthy: e.healthy,
              avgLatency: e.averageLatency,
              totalRequests: e.totalRequests,
              failedRequests: e.failedRequests,
            })),
          };
        }
      }

      const event = createWorkerStatusEvent({
        workerName: WORKER_NAME,
        status: this.isRunning ? 'RUNNING' : 'STOPPED',
        metrics,
      });

      // Publish to Redis (always)
      await this.redis.publish(CHANNELS.WORKERS_STATUS, JSON.stringify(event));

      // Also publish to RabbitMQ if enabled
      if (this.rabbitMQEnabled && this.rabbitMQConnection) {
        try {
          await publishWorkerEvent(
            this.rabbitMQConnection,
            'WORKER_STATUS',
            event.data,
            {
              routingKey: `worker.price-aggregator.${this.isRunning ? 'running' : 'stopped'}`,
              source: 'price-aggregator',
              correlationId: event.id,
            }
          );
          this.metrics.rabbitMQPublishSuccess++;
        } catch (error) {
          console.error('[PriceAggregator] RabbitMQ status publish failed:', error);
          this.metrics.rabbitMQPublishFailure++;
        }
      }
    } catch (error) {
      logger.error('Error publishing worker status:', error as Error);
    }
  }
}

// Main entry point
async function main(): Promise<void> {
  const worker = new PriceAggregatorWorker();

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    await worker.stop();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Start the worker
  try {
    await worker.start();
  } catch (error) {
    logger.error('Failed to start worker:', error as Error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}
