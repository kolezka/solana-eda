import Redis from 'ioredis';
import dotenv from 'dotenv';
import { SolanaConnectionManager, SidecarConnection, DEXAggregator } from '@solana-eda/solana-client';
import type { BestQuote, SwapResult } from '@solana-eda/solana-client';
import {
  PrismaClient,
  PositionRepository,
  TradeRepository,
  TradeSettingsRepository,
  WorkerStatusRepository,
} from '@solana-eda/database';
import {
  createTradeEvent,
  createPositionOpenedEvent,
  createPositionClosedEvent,
  CHANNELS,
  validateEvent,
  FeatureFlags,
} from '@solana-eda/events';
import type { AnyEvent } from '@solana-eda/events';
import { Keypair, PublicKey } from '@solana/web3.js';
import {
  RabbitMQConnection,
  initWorkerRabbitMQ,
  publishWorkerEvent,
  closeWorkerRabbitMQ,
} from '@solana-eda/rabbitmq';

dotenv.config();

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const prisma = new PrismaClient(undefined as never);
const positionRepo = new PositionRepository(prisma);
const tradeRepo = new TradeRepository(prisma);
const settingsRepo = new TradeSettingsRepository(prisma);
const workerStatusRepo = new WorkerStatusRepository(prisma);

const SOL_MINT = 'So11111111111111111111111111111112';
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

class TradingBotWorker {
  private connection: SolanaConnectionManager | SidecarConnection;
  private dexAggregator: DEXAggregator;
  private wallet: Keypair;
  private running = false;
  private workerName = 'trading-bot';
  private portfolioValue = 0;
  private useSidecar: boolean = false;

  // RabbitMQ properties
  private rabbitMQConnection: RabbitMQConnection | null = null;
  private rabbitMQEnabled = false;
  private dualWriteEnabled = false;

  private metrics = {
    eventsProcessed: 0,
    errors: 0,
    tradesExecuted: 0,
    startTime: Date.now(),
    // RabbitMQ metrics
    rabbitMQPublishSuccess: 0,
    rabbitMQPublishFailure: 0,
    // Sidecar metrics
    sidecarConnected: false,
  };

  constructor() {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.useSidecar = process.env.USE_SIDECAR === 'true';

    const privateKey = process.env.TRADING_PRIVATE_KEY;
    this.wallet = privateKey
      ? Keypair.fromSecretKey(Buffer.from(privateKey, 'base64'))
      : Keypair.generate();

    if (this.useSidecar) {
      this.connection = new SidecarConnection();
      console.log('[TradingBot] Using RPC Sidecar for connection');
    } else {
      this.connection = new SolanaConnectionManager({ rpcUrl });
      console.log('[TradingBot] Using direct Solana connection');
    }

    // Note: DEXAggregator expects a Connection, we need to handle this
    // For sidecar, we'll need to create a wrapper or update DEXAggregator
    this.dexAggregator = new DEXAggregator(
      // @ts-ignore - Connection type compatibility
      this.connection.getConnection ? this.connection.getConnection() : this.connection as any,
      this.wallet,
      redisUrl,
      {
        enabledDEXes: ['jupiter', 'orca', 'meteora', 'raydium'],
      }
    );

    console.log(`[TradingBot] Wallet address: ${this.wallet.publicKey.toString()}`);
    console.log(`[TradingBot] Enabled DEXes: ${this.dexAggregator.getEnabledDEXes().join(', ')}`);
  }

  /**
   * Initialize RabbitMQ connection for event publishing
   */
  private async initializeRabbitMQ() {
    // Check feature flags
    this.rabbitMQEnabled = FeatureFlags.isRabbitMQEnabled();
    this.dualWriteEnabled = FeatureFlags.isDualWriteEnabled();

    if (!this.rabbitMQEnabled) {
      console.log('[TradingBot] RabbitMQ publishing disabled');
      return;
    }

    try {
      console.log('[TradingBot] Initializing RabbitMQ connection...');
      this.rabbitMQConnection = await initWorkerRabbitMQ({
        url: FeatureFlags.getRabbitMQUrl(),
        exchangeName: 'solana.events',
        enablePublisherConfirms: true,
      });
      console.log('[TradingBot] RabbitMQ connection established');
    } catch (error) {
      console.error('[TradingBot] Failed to connect to RabbitMQ:', error);
      this.rabbitMQEnabled = false;
      this.rabbitMQConnection = null;
    }
  }

  async start() {
    console.log(`[TradingBot] Starting worker...`);

    // Log feature flags configuration
    FeatureFlags.logConfiguration(this.workerName);

    // Connect to sidecar if enabled
    if (this.useSidecar && this.connection instanceof SidecarConnection) {
      try {
        await this.connection.connect();
        this.metrics.sidecarConnected = true;
        console.log('[TradingBot] Connected to RPC Sidecar');
      } catch (error) {
        console.error('[TradingBot] Failed to connect to RPC Sidecar:', error);
        throw error;
      }
    }

    // Initialize RabbitMQ
    await this.initializeRabbitMQ();

    this.running = true;

    await this.updateWorkerStatus('RUNNING');

    await this.subscribeToBurnEvents();
    this.monitorPositions();

    console.log(`[TradingBot] Worker started successfully`);
  }

  async stop() {
    console.log(`[TradingBot] Stopping worker...`);
    this.running = false;

    // Close RabbitMQ connection
    if (this.rabbitMQConnection) {
      try {
        await closeWorkerRabbitMQ(this.rabbitMQConnection);
        console.log('[TradingBot] RabbitMQ connection closed');
      } catch (error) {
        console.error('[TradingBot] Error closing RabbitMQ:', error);
      }
      this.rabbitMQConnection = null;
    }

    await this.updateWorkerStatus('STOPPED');
    await this.dexAggregator.close();

    // Close sidecar connection if applicable
    if (this.connection instanceof SidecarConnection) {
      await this.connection.close();
    } else {
      await this.connection.close();
    }

    console.log(`[TradingBot] Worker stopped`);
  }

  private async updateWorkerStatus(status: 'RUNNING' | 'STOPPED' | 'ERROR', error?: string) {
    const metricsData = {
      ...this.metrics,
      uptime: Date.now() - this.metrics.startTime,
      portfolioValue: this.portfolioValue,
      lastEventAt: new Date().toISOString(),
    };

    await workerStatusRepo.upsert({
      name: this.workerName,
      status,
      metrics: metricsData as any,
    });

    const statusEvent: AnyEvent = {
      type: 'WORKER_STATUS',
      timestamp: new Date().toISOString(),
      id: `worker-${this.workerName}-${Date.now()}`,
      data: {
        workerName: this.workerName,
        status,
        metrics: metricsData,
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
            source: 'trading-bot',
            correlationId: statusEvent.id,
          }
        );
        this.metrics.rabbitMQPublishSuccess++;
      } catch (error) {
        console.error('[TradingBot] RabbitMQ status publish failed:', error);
        this.metrics.rabbitMQPublishFailure++;
      }
    }
  }

  private async subscribeToBurnEvents() {
    console.log(`[TradingBot] Subscribing to burn events...`);

    const subscriber = redis.duplicate();
    await subscriber.connect();

    await subscriber.subscribe(CHANNELS.EVENTS_BURN);

    subscriber.on('message', (channel, message) => {
      if (channel !== CHANNELS.EVENTS_BURN || !this.running) return;

      (async () => {
        try {
          const parsed = JSON.parse(message) as unknown;
          const event = validateEvent(parsed);
          await this.handleBurnEvent(event);
        } catch (error) {
          console.error(`[TradingBot] Error parsing burn event:`, error);
          this.metrics.errors++;
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await this.updateWorkerStatus('ERROR', errorMessage);
        }
      })().catch((err) => {
        console.error(`[TradingBot] Unhandled error in event handler:`, err);
      });
    });

    console.log(`[TradingBot] Subscribed to burn events channel`);
  }

  private async handleBurnEvent(event: AnyEvent) {
    try {
      console.log(`[TradingBot] Processing burn event: ${(event.data as any).token}`);

      const settings = await settingsRepo.findEnabled();
      if (!settings || !(settings as any).enabled) {
        console.log(`[TradingBot] Trading not enabled`);
        return;
      }

      const { token, amount, percentage } = event.data as any;
      const burnAmount = Number(amount);

      if (burnAmount < Number((settings as any).minBurnAmount)) {
        console.log(
          `[TradingBot] Burn amount ${burnAmount} below threshold ${(settings as any).minBurnAmount}`,
        );
        return;
      }

      const hasPosition = await positionRepo.hasOpenPositionForToken(token);
      if (hasPosition) {
        console.log(`[TradingBot] Already holding position for ${token}`);
        return;
      }

      const openPositions = await positionRepo.countOpenPositions();
      if (openPositions >= Number((settings as any).maxPositions)) {
        console.log(`[TradingBot] Max positions (${(settings as any).maxPositions}) reached`);
        return;
      }

      await this.executeBuyOrder(token, burnAmount, settings);

      this.metrics.eventsProcessed++;
      if (this.metrics.eventsProcessed % 10 === 0) {
        await this.updateWorkerStatus('RUNNING');
      }
    } catch (error) {
      console.error(`[TradingBot] Error handling burn event:`, error);
      throw error;
    }
  }

  private async executeBuyOrder(token: string, burnAmount: number, settings: any) {
    try {
      console.log(`[TradingBot] Executing buy order for ${token}`);

      const inputMint = new PublicKey(USDC_MINT);
      const outputMint = new PublicKey(token);
      const quoteAmount = Math.min(burnAmount * 0.5, Number(settings.maxSlippage) * 1000000);

      const bestQuote = await this.dexAggregator.getBestQuote(
        inputMint,
        outputMint,
        BigInt(quoteAmount),
      );

      console.log(`[TradingBot] Best quote from ${bestQuote.dex}:`);
      console.log(`[TradingBot]   In: ${bestQuote.inAmount}`);
      console.log(`[TradingBot]   Out: ${bestQuote.outAmount}`);
      console.log(`[TradingBot]   Price impact: ${(bestQuote.priceImpactPct * 100).toFixed(2)}%`);

      const swapResult = await this.dexAggregator.executeBestSwap(
        bestQuote,
        Number(settings.maxSlippage),
      );

      console.log(
        `[TradingBot] Swap executed on ${swapResult.dex} with signature: ${swapResult.signature}`,
      );

      const price =
        Number(bestQuote.outAmount) > 0
          ? Number(bestQuote.inAmount) / Number(bestQuote.outAmount)
          : 0;

      const stopLoss = price * (1 - Number(settings.stopLossPercent));
      const takeProfit = price * (1 + Number(settings.takeProfitPercent));

      const position = await positionRepo.create({
        token,
        amount: Number(bestQuote.outAmount),
        entryPrice: price,
        currentPrice: price,
        stopLoss,
        takeProfit,
      });

      await tradeRepo.create({
        positionId: position.id,
        type: 'BUY',
        amount: Number(bestQuote.outAmount),
        price,
        signature: swapResult.signature ?? '',
        slippage: swapResult.actualSlippage,
      });

      const tradeEvent: AnyEvent = {
        type: 'TRADE_EXECUTED',
        timestamp: new Date().toISOString(),
        id: `trade-${Date.now()}`,
        data: {
          tradeId: swapResult.signature ?? '',
          type: 'BUY',
          tokenIn: USDC_MINT,
          tokenOut: token,
          amountIn: bestQuote.inAmount ?? '0',
          amountOut: bestQuote.outAmount ?? '0',
          price: price.toString(),
          slippage: swapResult.actualSlippage,
          txSignature: swapResult.signature ?? '',
          positionId: position.id,
        },
      };

      // Publish to Redis (always)
      await redis.publish(CHANNELS.EVENTS_TRADES, JSON.stringify(tradeEvent));

      // Also publish to RabbitMQ if enabled
      if (this.rabbitMQEnabled && this.rabbitMQConnection) {
        try {
          await publishWorkerEvent(
            this.rabbitMQConnection,
            'TRADE_EXECUTED',
            tradeEvent.data,
            {
              routingKey: 'trade.executed',
              source: 'trading-bot',
              correlationId: tradeEvent.id,
            }
          );
          this.metrics.rabbitMQPublishSuccess++;
        } catch (error) {
          console.error('[TradingBot] RabbitMQ publish failed:', error);
          this.metrics.rabbitMQPublishFailure++;
        }
      }

      const positionEvent: AnyEvent = {
        type: 'POSITION_OPENED',
        timestamp: new Date().toISOString(),
        id: `pos-open-${Date.now()}`,
        data: {
          positionId: position.id,
          token,
          amount: bestQuote.outAmount ?? '0',
          entryPrice: price.toString(),
          stopLoss: stopLoss.toString(),
          takeProfit: takeProfit.toString(),
        },
      };

      // Publish to Redis (always)
      await redis.publish(CHANNELS.EVENTS_POSITIONS, JSON.stringify(positionEvent));

      // Also publish to RabbitMQ if enabled
      if (this.rabbitMQEnabled && this.rabbitMQConnection) {
        try {
          await publishWorkerEvent(
            this.rabbitMQConnection,
            'POSITION_OPENED',
            positionEvent.data,
            {
              routingKey: 'position.opened',
              source: 'trading-bot',
              correlationId: positionEvent.id,
            }
          );
          this.metrics.rabbitMQPublishSuccess++;
        } catch (error) {
          console.error('[TradingBot] RabbitMQ publish failed:', error);
          this.metrics.rabbitMQPublishFailure++;
        }
      }

      this.metrics.tradesExecuted++;

      console.log(`[TradingBot] Buy order executed: Position ${position.id} on ${swapResult.dex}`);
    } catch (error) {
      console.error(`[TradingBot] Error executing buy order:`, error);
      throw error;
    }
  }

  private monitorPositions() {
    console.log(`[TradingBot] Starting position monitoring...`);

    setInterval(async () => {
      if (!this.running) return;

      try {
        await this.checkPositions();
      } catch (error) {
        console.error(`[TradingBot] Error checking positions:`, error);
        this.metrics.errors++;
      }
    }, 30000);
  }

  private async checkPositions() {
    const positions = await positionRepo.findOpenPositions();

    for (const position of positions) {
      try {
        const currentPrice = await this.getCurrentPrice(position.token);
        await positionRepo.updateCurrentPrice(position.id, currentPrice);

        const entryPrice = Number(position.entryPrice);
        const stopLoss = position.stopLoss ? Number(position.stopLoss) : entryPrice * 0.9;
        const takeProfit = position.takeProfit ? Number(position.takeProfit) : entryPrice * 1.5;

        if (currentPrice <= stopLoss) {
          console.log(`[TradingBot] Stop-loss triggered for position ${position.id}`);
          await this.executeSellOrder(position, currentPrice, 'STOP_LOSS');
        } else if (currentPrice >= takeProfit) {
          console.log(`[TradingBot] Take-profit triggered for position ${position.id}`);
          await this.executeSellOrder(position, currentPrice, 'TAKE_PROFIT');
        }
      } catch (error) {
        console.error(`[TradingBot] Error checking position ${position.id}:`, error);
      }
    }
  }

  private async executeSellOrder(
    position: any,
    currentPrice: number,
    reason: 'STOP_LOSS' | 'TAKE_PROFIT' | 'MANUAL' | 'TIMEOUT',
  ) {
    try {
      console.log(`[TradingBot] Executing sell order for position ${position.id}`);

      const inputMint = new PublicKey(position.token);
      const outputMint = new PublicKey(USDC_MINT);
      const amount = Math.floor(Number(position.amount));

      const bestQuote = await this.dexAggregator.getBestQuote(
        inputMint,
        outputMint,
        BigInt(amount),
      );

      const swapResult = await this.dexAggregator.executeBestSwap(bestQuote, 0.03);

      console.log(
        `[TradingBot] Sell executed on ${swapResult.dex} with signature: ${swapResult.signature}`,
      );

      const updatedPosition = await positionRepo.closePosition(position.id, currentPrice, reason);

      await tradeRepo.create({
        positionId: position.id,
        type: 'SELL',
        amount,
        price: currentPrice,
        signature: swapResult.signature ?? '',
        slippage: swapResult.actualSlippage,
      });

      const tradeEvent: AnyEvent = {
        type: 'TRADE_EXECUTED',
        timestamp: new Date().toISOString(),
        id: `trade-${Date.now()}`,
        data: {
          tradeId: swapResult.signature ?? '',
          type: 'SELL',
          tokenIn: position.token,
          tokenOut: USDC_MINT,
          amountIn: amount.toString(),
          amountOut: bestQuote.outAmount ?? '0',
          price: currentPrice.toString(),
          slippage: swapResult.actualSlippage,
          txSignature: swapResult.signature ?? '',
          positionId: position.id,
        },
      };

      // Publish to Redis (always)
      await redis.publish(CHANNELS.EVENTS_TRADES, JSON.stringify(tradeEvent));

      // Also publish to RabbitMQ if enabled
      if (this.rabbitMQEnabled && this.rabbitMQConnection) {
        try {
          await publishWorkerEvent(
            this.rabbitMQConnection,
            'TRADE_EXECUTED',
            tradeEvent.data,
            {
              routingKey: 'trade.executed',
              source: 'trading-bot',
              correlationId: tradeEvent.id,
            }
          );
          this.metrics.rabbitMQPublishSuccess++;
        } catch (error) {
          console.error('[TradingBot] RabbitMQ publish failed:', error);
          this.metrics.rabbitMQPublishFailure++;
        }
      }

      const pnl = Number(updatedPosition.pnl);
      const holdDuration = updatedPosition.closedAt
        ? new Date(updatedPosition.closedAt).getTime() -
          new Date(updatedPosition.openedAt).getTime()
        : 0;

      const positionEvent: AnyEvent = {
        type: 'POSITION_CLOSED',
        timestamp: new Date().toISOString(),
        id: `pos-close-${Date.now()}`,
        data: {
          positionId: position.id,
          token: position.token,
          exitPrice: currentPrice.toString(),
          pnl: pnl.toString(),
          pnlPercent: pnl,
          holdDuration,
          closeReason: reason,
        },
      };

      // Publish to Redis (always)
      await redis.publish(CHANNELS.EVENTS_POSITIONS, JSON.stringify(positionEvent));

      // Also publish to RabbitMQ if enabled
      if (this.rabbitMQEnabled && this.rabbitMQConnection) {
        try {
          await publishWorkerEvent(
            this.rabbitMQConnection,
            'POSITION_CLOSED',
            positionEvent.data,
            {
              routingKey: 'position.closed',
              source: 'trading-bot',
              correlationId: positionEvent.id,
            }
          );
          this.metrics.rabbitMQPublishSuccess++;
        } catch (error) {
          console.error('[TradingBot] RabbitMQ publish failed:', error);
          this.metrics.rabbitMQPublishFailure++;
        }
      }

      console.log(
        `[TradingBot] Sell order executed: Position ${position.id}, P&L: ${pnl.toFixed(2)}%`,
      );
    } catch (error) {
      console.error(`[TradingBot] Error executing sell order:`, error);
      throw error;
    }
  }

  private async getCurrentPrice(token: string): Promise<number> {
    try {
      const inputMint = new PublicKey(token);
      const outputMint = new PublicKey(USDC_MINT);

      const bestQuote = await this.dexAggregator.getBestQuote(
        inputMint,
        outputMint,
        BigInt(1000000),
      );

      return Number(bestQuote.outAmount) / 1000000;
    } catch (error) {
      console.error(`[TradingBot] Error getting price for ${token}:`, error);
      return 100;
    }
  }
}

async function main() {
  const bot = new TradingBotWorker();

  process.on('SIGINT', async () => {
    console.log('\n[TradingBot] Received SIGINT, shutting down...');
    await bot.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n[TradingBot] Received SIGTERM, shutting down...');
    await bot.stop();
    process.exit(0);
  });

  await bot.start();
}

main().catch((error) => {
  console.error('[TradingBot] Fatal error:', error);
  process.exit(1);
});
