import { Injectable, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import { validateEvent, CHANNELS } from '@solana-eda/events';
import { PrismaClient } from '@prisma/client';
import { BurnEventRepository, LiquidityPoolRepository, TradeRepository, PositionRepository, PriceRepository } from '@solana-eda/database';

@Injectable()
export class EventsService {
  private burnEventRepo: BurnEventRepository;
  private liquidityPoolRepo: LiquidityPoolRepository;
  private tradeRepo: TradeRepository;
  private positionRepo: PositionRepository;
  private priceRepo: PriceRepository;

  constructor(
    @Inject('REDIS') private redis: Redis,
    @Inject('PRISMA') private prisma: PrismaClient
  ) {
    this.burnEventRepo = new BurnEventRepository(prisma);
    this.liquidityPoolRepo = new LiquidityPoolRepository(prisma);
    this.tradeRepo = new TradeRepository(prisma);
    this.positionRepo = new PositionRepository(prisma);
    this.priceRepo = new PriceRepository(prisma);
  }

  async getRecentEvents(limit: number = 50) {
    const [burnEvents, liquidityEvents, tradeEvents, positionEvents] = await Promise.all([
      this.getBurnEvents(limit),
      this.getLiquidityEvents(limit),
      this.getTradeEvents(limit),
      this.getPositionEvents(limit),
    ]);

    return {
      burnEvents,
      liquidityEvents,
      tradeEvents,
      positionEvents,
    };
  }

  async getBurnEvents(limit: number = 50) {
    const events = await this.burnEventRepo.findRecent(limit);
    return events.map(event => ({
      id: event.id,
      txSignature: event.txSignature,
      token: event.token,
      amount: event.amount.toString(),
      percentage: Number(event.percentage),
      timestamp: event.timestamp.toISOString(),
      processed: event.processed,
    }));
  }

  async getLiquidityEvents(limit: number = 50) {
    const pools = await this.liquidityPoolRepo.findAll(limit);
    return pools.map(pool => ({
      id: pool.id,
      address: pool.address,
      tokenA: pool.tokenA,
      tokenB: pool.tokenB,
      tvl: pool.tvl.toString(),
      price: pool.price.toString(),
      volume24h: pool.volume24h.toString(),
      updatedAt: pool.updatedAt.toISOString(),
    }));
  }

  async getTradeEvents(limit: number = 50) {
    const trades = await this.tradeRepo.findRecent(limit);
    return trades.map(trade => ({
      id: trade.id,
      positionId: trade.positionId,
      type: trade.type,
      amount: trade.amount.toString(),
      price: trade.price.toString(),
      signature: trade.signature,
      slippage: Number(trade.slippage),
      timestamp: trade.timestamp.toISOString(),
      position: trade.position ? {
        id: trade.position.id,
        token: trade.position.token,
        status: trade.position.status,
      } : null,
    }));
  }

  async getPositionEvents(limit: number = 50) {
    const positions = await this.positionRepo.findOpenPositions();
    return positions.slice(0, limit).map(position => ({
      id: position.id,
      token: position.token,
      amount: position.amount.toString(),
      entryPrice: position.entryPrice.toString(),
      currentPrice: position.currentPrice.toString(),
      pnl: Number(position.pnl),
      status: position.status,
      openedAt: position.openedAt.toISOString(),
      closedAt: position.closedAt?.toISOString(),
      stopLoss: position.stopLoss?.toString(),
      takeProfit: position.takeProfit?.toString(),
      trades: position.trades.map(trade => ({
        id: trade.id,
        type: trade.type,
        amount: trade.amount.toString(),
        price: trade.price.toString(),
        timestamp: trade.timestamp.toISOString(),
      })),
    }));
  }

  async subscribeToChannel(channel: string, callback: (message: string) => void) {
    const subscriber = this.redis.duplicate();
    await subscriber.subscribe(channel);
    subscriber.on('message', (chan, message) => {
      if (chan === channel) {
        callback(message);
      }
    });
    return subscriber;
  }

  async getPriceEvents(limit: number = 100, token?: string) {
    let priceRecords;

    if (token) {
      priceRecords = await this.priceRepo.findByToken(token, limit);
    } else {
      // Get recent prices across all tokens
      // Since PriceRepository doesn't have findRecent, we'll use findByToken for each tracked token
      const trackedTokens = process.env.TRACKED_TOKENS?.split(',') || [];
      const allPrices = [];

      for (const tokenMint of trackedTokens.slice(0, 10)) {
        // Limit to 10 tokens to avoid too many queries
        try {
          const tokenPrices = await this.priceRepo.findByToken(tokenMint.trim(), Math.ceil(limit / trackedTokens.length));
          allPrices.push(...tokenPrices);
        } catch (error) {
          console.error(`Error fetching prices for ${tokenMint}:`, error);
        }
      }

      // Sort by timestamp descending and limit
      allPrices.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      priceRecords = allPrices.slice(0, limit);
    }

    return priceRecords.map(record => ({
      id: record.id,
      token: record.token,
      price: record.price.toString(),
      source: record.source,
      confidence: Number(record.confidence),
      volume24h: record.volume24h?.toString(),
      timestamp: record.timestamp.toISOString(),
    }));
  }
}
