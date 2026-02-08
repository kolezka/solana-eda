import Redis from 'ioredis';
import dotenv from 'dotenv';
import { SolanaConnectionManager, DEXAggregator } from '@solana-eda/solana-client';
import { getPrismaClient, PositionRepository, TradeRepository, TradeSettingsRepository, WorkerStatusRepository } from '@solana-eda/database';
import { createTradeEvent, createPositionOpenedEvent, createPositionClosedEvent, CHANNELS, validateEvent } from '@solana-eda/events';
import { Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';

dotenv.config();

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const prisma = getPrismaClient();
const positionRepo = new PositionRepository(prisma);
const tradeRepo = new TradeRepository(prisma);
const settingsRepo = new TradeSettingsRepository(prisma);
const workerStatusRepo = new WorkerStatusRepository(prisma);

const SOL_MINT = 'So11111111111111111111111111111111111111112'; // Wrapped SOL
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC

// Position sizing strategies
enum PositionSizingStrategy {
  FIXED = 'FIXED',
  PERCENTAGE_OF_PORTFOLIO = 'PERCENTAGE_OF_PORTFOLIO',
  KELLY_CRITERION = 'KELLY_CRITERION',
  RISK_BASED = 'RISK_BASED',
}

// Trade execution status
interface TradeExecution {
  success: boolean;
  signature?: string;
  error?: string;
  actualAmount?: bigint;
  actualPrice?: number;
  slippage?: number;
}

class TradingBotWorker {
  private connection: SolanaConnectionManager;
  private dexAggregator: DEXAggregator;
  private wallet: Keypair;
  private running = false;
  private workerName = 'trading-bot';
  private portfolioValue: number = 0;
  private metrics = {
    eventsProcessed: 0,
    errors: 0,
    tradesExecuted: 0,
    tradesSuccessful: 0,
    tradesFailed: 0,
    totalPnL: 0,
    totalVolume: 0,
    startTime: Date.now(),
  };

  constructor() {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    // Get wallet from private key (or generate a new one for demo)
    const privateKey = process.env.TRADING_PRIVATE_KEY;
    this.wallet = privateKey
      ? Keypair.fromSecretKey(Buffer.from(privateKey, 'base64'))
      : Keypair.generate();

    this.connection = new SolanaConnectionManager(rpcUrl);
    this.dexAggregator = new DEXAggregator(
      this.connection.getConnection(),
      this.wallet,
      redisUrl,
      {
        enabledDEXes: ['jupiter', 'orca', 'meteora', 'raydium'],
      }
    );

    console.log(`[TradingBot] Wallet address: ${this.wallet.publicKey.toString()}`);
    console.log(`[TradingBot] Enabled DEXes: ${this.dexAggregator.getEnabledDEXes().join(', ')}`);

    // Initialize portfolio value
    this.updatePortfolioValue();
  }

  async start() {
    console.log(`[TradingBot] Starting worker...`);
    this.running = true;

    await this.updateWorkerStatus('RUNNING');

    // Subscribe to burn events
    await this.subscribeToBurnEvents();

    // Start position monitoring
    this.monitorPositions();

    // Update portfolio value periodically
    setInterval(() => this.updatePortfolioValue(), 60000);

    console.log(`[TradingBot] Worker started successfully`);
  }

  async stop() {
    console.log(`[TradingBot] Stopping worker...`);
    this.running = false;

    // Close all positions on shutdown if configured
    if (process.env.CLOSE_POSITIONS_ON_SHUTDOWN === 'true') {
      await this.closeAllPositions('MANUAL');
    }

    await this.updateWorkerStatus('STOPPED');
    await this.dexAggregator.close();
    await this.connection.close();

    console.log(`[TradingBot] Worker stopped`);
  }

  private async updateWorkerStatus(status: 'RUNNING' | 'STOPPED' | 'ERROR', error?: string) {
    const metrics = {
      ...this.metrics,
      uptime: Date.now() - this.metrics.startTime,
      portfolioValue: this.portfolioValue,
      lastEventAt: new Date().toISOString(),
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

  private async updatePortfolioValue() {
    try {
      const balance = await this.connection.getBalance(this.wallet.publicKey);
      this.portfolioValue = balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error(`[TradingBot] Error updating portfolio value:`, error);
    }
  }

  private async subscribeToBurnEvents() {
    console.log(`[TradingBot] Subscribing to burn events...`);

    const subscriber = redis.duplicate();
    await subscriber.subscribe(CHANNELS.EVENTS_BURN);

    subscriber.on('message', (channel, message) => {
      if (channel === CHANNELS.EVENTS_BURN && this.running) {
        try {
          const event = validateEvent(JSON.parse(message));
          this.handleBurnEvent(event).catch((error) => {
            console.error(`[TradingBot] Error handling burn event:`, error);
            this.metrics.errors++;
            this.metrics.tradesFailed++;
            this.updateWorkerStatus('ERROR', error?.message);
          });
        } catch (error) {
          console.error(`[TradingBot] Error parsing burn event:`, error);
          this.metrics.errors++;
        }
      }
    });

    console.log(`[TradingBot] Subscribed to burn events channel`);
  }

  private async handleBurnEvent(event: any) {
    try {
      console.log(`[TradingBot] Processing burn event: ${event.data.token.slice(0, 8)}...`);

      // Get trade settings
      const settingsArray = await settingsRepo.findEnabled();
      const settings = settingsArray[0]; // Take first enabled settings
      if (!settings || !settings.enabled) {
        console.log(`[TradingBot] Trading not enabled`);
        return;
      }

      const { token, amount, percentage } = event.data;
      const burnAmount = Number(amount);

      // Check burn amount threshold
      if (burnAmount < Number(settings.minBurnAmount)) {
        console.log(`[TradingBot] Burn amount ${burnAmount} below threshold ${settings.minBurnAmount}`);
        return;
      }

      // Check if already holding this token
      const hasPosition = await positionRepo.hasOpenPositionForToken(token);
      if (hasPosition) {
        console.log(`[TradingBot] Already holding position for ${token}`);
        return;
      }

      // Check position limit
      const openPositions = await positionRepo.countOpenPositions();
      if (openPositions >= Number(settings.maxPositions)) {
        console.log(`[TradingBot] Max positions (${settings.maxPositions}) reached`);
        return;
      }

      // Pre-flight checks
      const canExecute = await this.preFlightChecks(token, burnAmount, settings);
      if (!canExecute.canTrade) {
        console.log(`[TradingBot] Pre-flight checks failed: ${canExecute.reason}`);
        return;
      }

      // Calculate position size
      const positionSize = await this.calculatePositionSize(
        token,
        burnAmount,
        settings,
        PositionSizingStrategy.RISK_BASED
      );

      console.log(`[TradingBot] Position size: ${positionSize} USDC`);

      // Execute buy order with retry logic
      const result = await this.executeBuyOrderWithRetry(
        token,
        positionSize,
        settings,
        3 // max retries
      );

      if (result.success) {
        this.metrics.tradesSuccessful++;
        this.metrics.totalVolume += positionSize;
      } else {
        this.metrics.tradesFailed++;
        console.error(`[TradingBot] Buy order failed: ${result.error}`);
      }

      this.metrics.eventsProcessed++;

      if (this.metrics.eventsProcessed % 10 === 0) {
        await this.updateWorkerStatus('RUNNING');
      }

    } catch (error) {
      console.error(`[TradingBot] Error handling burn event:`, error);
      throw error;
    }
  }

  /**
   * Pre-flight checks before executing trade
   */
  private async preFlightChecks(
    token: string,
    burnAmount: number,
    settings: any
  ): Promise<{ canTrade: boolean; reason?: string }> {
    try {
      // Check wallet balance
      const balance = await this.connection.getBalance(this.wallet.publicKey);
      const minBalance = 10000000; // 0.01 SOL minimum for rent
      const availableBalance = balance - minBalance;

      if (availableBalance <= 0) {
        return { canTrade: false, reason: 'Insufficient SOL balance for fees' };
      }

      // Check if token is tradeable
      const tokenPublicKey = new PublicKey(token);
      const quote = await this.dexAggregator.getBestQuote(
        new PublicKey(USDC_MINT),
        tokenPublicKey,
        BigInt(1000000) // Minimum test amount
      );

      if (!quote || !quote.outAmount || quote.outAmount === '0') {
        return { canTrade: false, reason: 'No liquidity available for token' };
      }

      // Check if price impact is acceptable
      const maxPriceImpact = Number(settings.maxPriceImpact || 0.05); // 5% default
      if (quote.priceImpactPct > maxPriceImpact) {
        return { canTrade: false, reason: `Price impact too high: ${(quote.priceImpactPct * 100).toFixed(2)}%` };
      }

      return { canTrade: true };
    } catch (error) {
      console.error(`[TradingBot] Error in pre-flight checks:`, error);
      return { canTrade: false, reason: 'Pre-flight check error' };
    }
  }

  /**
   * Calculate position size based on strategy
   */
  private async calculatePositionSize(
    token: string,
    burnAmount: number,
    settings: any,
    strategy: PositionSizingStrategy
  ): Promise<number> {
    const maxSlippage = Number(settings.maxSlippage);
    const maxPositionValue = Number(settings.maxPositionSize || 1000); // Default $1000 max

    switch (strategy) {
      case PositionSizingStrategy.FIXED:
        return Math.min(burnAmount * 0.1, maxPositionValue);

      case PositionSizingStrategy.PERCENTAGE_OF_PORTFOLIO:
        const portfolioPercent = Number(settings.portfolioPercent || 0.05); // 5% default
        return Math.min(this.portfolioValue * portfolioPercent, maxPositionValue);

      case PositionSizingStrategy.RISK_BASED:
        // Size position based on stop-loss distance
        const stopLossPercent = Number(settings.stopLossPercent);
        const riskPercent = Number(settings.riskPerTrade || 0.01); // 1% risk per trade

        if (stopLossPercent > 0) {
          const riskAmount = this.portfolioValue * riskPercent;
          return Math.min(riskAmount / stopLossPercent, maxPositionValue);
        }
        return Math.min(burnAmount * 0.1, maxPositionValue);

      case PositionSizingStrategy.KELLY_CRITERION:
        // Simplified Kelly calculation (would need historical win rate)
        const winRate = Number(settings.winRate || 0.5);
        const avgWin = Number(settings.avgWin || 0.2);
        const avgLoss = Number(settings.avgLoss || 0.1);

        const kelly = (winRate * avgWin - (1 - winRate) * avgLoss) / avgWin;
        return Math.min(this.portfolioValue * Math.max(0, kelly * 0.5), maxPositionValue);

      default:
        return Math.min(burnAmount * 0.1, maxPositionValue);
    }
  }

  /**
   * Execute buy order with retry logic
   */
  private async executeBuyOrderWithRetry(
    token: string,
    amount: number,
    settings: any,
    maxRetries: number
  ): Promise<TradeExecution> {
    let lastError: Error | undefined;
    const baseDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[TradingBot] Buy attempt ${attempt}/${maxRetries} for ${token.slice(0, 8)}... (${amount.toFixed(2)} USDC)`);

        const result = await this.executeBuyOrder(token, amount, settings);

        if (result.success) {
          this.metrics.tradesExecuted++;
          return result;
        }
      } catch (error) {
        lastError = error as Error;
        console.warn(`[TradingBot] Buy attempt ${attempt} failed:`, error);

        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`[TradingBot] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Max retries exceeded',
    };
  }

  /**
   * Execute buy order
   */
  private async executeBuyOrder(
    token: string,
    amount: number,
    settings: any
  ): Promise<TradeExecution> {
    try {
      console.log(`[TradingBot] Executing buy order for ${token.slice(0, 8)}...`);

      const inputMint = new PublicKey(USDC_MINT);
      const outputMint = new PublicKey(token);
      const quoteAmount = Math.floor(amount * 1_000_000); // Convert to USDC smallest unit

      // Get best quote
      const bestQuote = await this.dexAggregator.getBestQuote(inputMint, outputMint, BigInt(quoteAmount));

      if (!bestQuote || !bestQuote.outAmount || bestQuote.outAmount === '0') {
        return { success: false, error: 'No quotes available' };
      }

      console.log(`[TradingBot] Best quote from ${bestQuote.dex}:`);
      console.log(`[TradingBot]   In: ${bestQuote.inAmount} USDC`);
      console.log(`[TradingBot]   Out: ${bestQuote.outAmount} tokens`);
      console.log(`[TradingBot]   Price impact: ${(bestQuote.priceImpactPct * 100).toFixed(2)}%`);

      // Simulate transaction first
      const simulationResult = await this.simulateTransaction(bestQuote);
      if (!simulationResult.success) {
        return { success: false, error: `Transaction simulation failed: ${simulationResult.error}` };
      }

      // Execute swap
      const swapResult = await this.dexAggregator.executeBestSwap(bestQuote, Number(settings.maxSlippage));

      console.log(`[TradingBot] Swap executed on ${swapResult.dex} with signature: ${swapResult.signature}`);

      // Calculate price
      const outAmount = Number(bestQuote.outAmount);
      const price = outAmount > 0 ? amount / outAmount : 0;

      // Create position
      const stopLoss = price * (1 - Number(settings.stopLossPercent));
      const takeProfit = price * (1 + Number(settings.takeProfitPercent));

      const position = await positionRepo.create({
        token,
        amount: Number(outAmount),
        entryPrice: price,
        currentPrice: price,
        stopLoss: stopLoss,
        takeProfit: takeProfit,
      });

      // Create trade record
      await tradeRepo.create({
        positionId: position.id,
        type: 'BUY',
        amount: Number(outAmount),
        price: price,
        signature: swapResult.signature || '',
        slippage: swapResult.actualSlippage,
      });

      // Publish events
      const tradeEvent = createTradeEvent({
        tradeId: swapResult.signature || '',
        type: 'BUY',
        tokenIn: USDC_MINT,
        tokenOut: token,
        amountIn: bestQuote.inAmount,
        amountOut: bestQuote.outAmount,
        price: price.toString(),
        slippage: swapResult.actualSlippage || 0,
        txSignature: swapResult.signature || '',
        positionId: position.id,
      });

      await redis.publish(CHANNELS.EVENTS_TRADES, JSON.stringify(tradeEvent));

      const positionEvent = createPositionOpenedEvent({
        positionId: position.id,
        token,
        amount: bestQuote.outAmount,
        entryPrice: price.toString(),
        stopLoss: stopLoss.toString(),
        takeProfit: takeProfit.toString(),
      });

      await redis.publish(CHANNELS.EVENTS_POSITIONS, JSON.stringify(positionEvent));

      console.log(`[TradingBot] Buy order executed: Position ${position.id} on ${swapResult.dex}`);

      return {
        success: true,
        signature: swapResult.signature || undefined,
        actualAmount: BigInt(bestQuote.outAmount),
        actualPrice: price,
        slippage: swapResult.actualSlippage,
      };

    } catch (error) {
      console.error(`[TradingBot] Error executing buy order:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Simulate transaction before execution
   */
  private async simulateTransaction(quote: any): Promise<{ success: boolean; error?: string }> {
    try {
      // In production, this would simulate the transaction
      // For now, we'll check if the quote is valid
      if (!quote || !quote.outAmount || BigInt(quote.outAmount) === BigInt(0)) {
        return { success: false, error: 'Invalid quote' };
      }

      if (quote.priceImpactPct > 0.1) { // 10% max price impact
        return { success: false, error: 'Price impact too high' };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Simulation failed',
      };
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
    }, 30000); // Check every 30 seconds
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

        const pnl = ((currentPrice - entryPrice) / entryPrice) * 100;

        // Check stop-loss
        if (currentPrice <= stopLoss) {
          console.log(`[TradingBot] Stop-loss triggered for position ${position.id} (P&L: ${pnl.toFixed(2)}%)`);
          await this.executeSellOrder(position, currentPrice, 'STOP_LOSS');
        }
        // Check take-profit
        else if (currentPrice >= takeProfit) {
          console.log(`[TradingBot] Take-profit triggered for position ${position.id} (P&L: ${pnl.toFixed(2)}%)`);
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
    reason: 'STOP_LOSS' | 'TAKE_PROFIT' | 'MANUAL' | 'TIMEOUT'
  ) {
    try {
      console.log(`[TradingBot] Executing sell order for position ${position.id} (${reason})`);

      const inputMint = new PublicKey(position.token);
      const outputMint = new PublicKey(USDC_MINT);
      const amount = Math.floor(Number(position.amount));

      const bestQuote = await this.dexAggregator.getBestQuote(inputMint, outputMint, BigInt(amount));

      if (!bestQuote || !bestQuote.outAmount || bestQuote.outAmount === '0') {
        console.error(`[TradingBot] No quotes available for sell order`);
        return;
      }

      const swapResult = await this.dexAggregator.executeBestSwap(bestQuote, 0.03);

      console.log(`[TradingBot] Sell executed on ${swapResult.dex} with signature: ${swapResult.signature}`);

      const updatedPosition = await positionRepo.closePosition(position.id, currentPrice, reason);

      await tradeRepo.create({
        positionId: position.id,
        type: 'SELL',
        amount: Number(amount),
        price: currentPrice,
        signature: swapResult.signature || '',
        slippage: swapResult.actualSlippage || 0,
      });

      const tradeEvent = createTradeEvent({
        tradeId: swapResult.signature || '',
        type: 'SELL',
        tokenIn: position.token,
        tokenOut: USDC_MINT,
        amountIn: amount.toString(),
        amountOut: bestQuote.outAmount,
        price: currentPrice.toString(),
        slippage: swapResult.actualSlippage || 0,
        txSignature: swapResult.signature || '',
        positionId: position.id,
      });

      await redis.publish(CHANNELS.EVENTS_TRADES, JSON.stringify(tradeEvent));

      const pnl = Number(updatedPosition.pnl);
      const holdDuration = updatedPosition.closedAt
        ? new Date(updatedPosition.closedAt).getTime() - new Date(updatedPosition.openedAt).getTime()
        : 0;

      this.metrics.totalPnL += pnl;

      const positionEvent = createPositionClosedEvent({
        positionId: position.id,
        token: position.token,
        exitPrice: currentPrice.toString(),
        pnl: pnl.toString(),
        pnlPercent: pnl,
        holdDuration,
        closeReason: reason,
      });

      await redis.publish(CHANNELS.EVENTS_POSITIONS, JSON.stringify(positionEvent));

      console.log(`[TradingBot] Sell order executed: Position ${position.id}, P&L: ${pnl.toFixed(2)}%`);

    } catch (error) {
      console.error(`[TradingBot] Error executing sell order:`, error);
      throw error;
    }
  }

  private async getCurrentPrice(token: string): Promise<number> {
    try {
      const inputMint = new PublicKey(token);
      const outputMint = new PublicKey(USDC_MINT);

      const bestQuote = await this.dexAggregator.getBestQuote(inputMint, outputMint, BigInt(1000000));

      return Number(bestQuote.outAmount) / 1000000;
    } catch (error) {
      console.error(`[TradingBot] Error getting price for ${token}:`, error);
      return 0;
    }
  }

  private async closeAllPositions(reason: 'MANUAL' | 'TIMEOUT'): Promise<void> {
    const positions = await positionRepo.findOpenPositions();

    console.log(`[TradingBot] Closing ${positions.length} positions...`);

    for (const position of positions) {
      try {
        const currentPrice = await this.getCurrentPrice(position.token);
        await this.executeSellOrder(position, currentPrice, reason);
      } catch (error) {
        console.error(`[TradingBot] Error closing position ${position.id}:`, error);
      }
    }
  }
}

// Main execution
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

  process.on('uncaughtException', (error) => {
    console.error('[TradingBot] Uncaught exception:', error);
    bot.stop().finally(() => process.exit(1));
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('[TradingBot] Unhandled rejection at:', promise, 'reason:', reason);
  });

  await bot.start();
}

main().catch((error) => {
  console.error('[TradingBot] Fatal error:', error);
  process.exit(1);
});
