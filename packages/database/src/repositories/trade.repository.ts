import type { PrismaClient } from '../generated/client';
import type { Trade, TradeWithPosition } from '../types';

export class TradeRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    positionId: string;
    type: 'BUY' | 'SELL';
    amount: number;
    price: number;
    signature: string;
    slippage: number;
  }): Promise<Trade> {
    const result = await this.prisma.trade.create({
      data: {
        ...data,
        amount: data.amount,
        price: data.price,
        slippage: data.slippage,
      },
    });
    return result as unknown as Trade;
  }

  async findById(id: string): Promise<TradeWithPosition | null> {
    const result = await this.prisma.trade.findUnique({
      where: { id },
      include: { position: true },
    });
    return result as unknown as TradeWithPosition | null;
  }

  async findByPositionId(positionId: string): Promise<Trade[]> {
    const result = await this.prisma.trade.findMany({
      where: { positionId },
      orderBy: { timestamp: 'desc' },
    });
    return result as unknown as Trade[];
  }

  async findBySignature(signature: string): Promise<TradeWithPosition | null> {
    const result = await this.prisma.trade.findUnique({
      where: { signature },
      include: { position: true },
    });
    return result as unknown as TradeWithPosition | null;
  }

  async findRecent(limit: number = 50): Promise<TradeWithPosition[]> {
    const result = await this.prisma.trade.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: { position: true },
    });
    return result as unknown as TradeWithPosition[];
  }

  async findTradesByType(type: 'BUY' | 'SELL', limit: number = 50): Promise<TradeWithPosition[]> {
    const result = await this.prisma.trade.findMany({
      where: { type },
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: { position: true },
    });
    return result as unknown as TradeWithPosition[];
  }

  async calculateTotalVolume(startDate: Date, endDate: Date): Promise<number> {
    const result = await this.prisma.trade.aggregate({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        amount: true,
      },
    });

    return Number(result._sum.amount || 0);
  }

  async calculateWinRate(startDate: Date, endDate: Date): Promise<number> {
    const trades = await this.prisma.trade.findMany({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
        type: 'SELL',
      },
      include: { position: true },
    });

    if (trades.length === 0) return 0;

    const winningTrades = trades.filter((trade: any) => {
      return trade.position && Number(trade.position.pnl) > 0;
    });

    return (winningTrades.length / trades.length) * 100;
  }

  async countTradesInRange(startDate: Date, endDate: Date): Promise<number> {
    return await this.prisma.trade.count({
      where: {
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
    });
  }
}
