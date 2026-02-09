import type { PrismaClient } from '../generated/client';
import type { Position, PositionWithTrades } from '../types';

export class PositionRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    accountId?: string;
    token: string;
    amount: number;
    entryPrice: number;
    currentPrice: number;
    stopLoss?: number;
    takeProfit?: number;
  }): Promise<PositionWithTrades> {
    const result = await this.prisma.position.create({
      data: data.accountId
        ? {
            token: data.token,
            amount: data.amount,
            entryPrice: data.entryPrice,
            currentPrice: data.currentPrice,
            stopLoss: data.stopLoss,
            takeProfit: data.takeProfit,
            accountId: data.accountId,
            status: 'OPEN',
          }
        : {
            token: data.token,
            amount: data.amount,
            entryPrice: data.entryPrice,
            currentPrice: data.currentPrice,
            stopLoss: data.stopLoss,
            takeProfit: data.takeProfit,
            status: 'OPEN',
          },
      include: { trades: true },
    });
    return result as unknown as PositionWithTrades;
  }

  async findById(id: string): Promise<PositionWithTrades | null> {
    const result = await this.prisma.position.findUnique({
      where: { id },
      include: { trades: true },
    });
    return result as unknown as PositionWithTrades | null;
  }

  async findOpenPositions(): Promise<PositionWithTrades[]> {
    const result = await this.prisma.position.findMany({
      where: { status: 'OPEN' },
      include: { trades: true },
      orderBy: { openedAt: 'desc' },
    });
    return result as unknown as PositionWithTrades[];
  }

  async findClosedPositions(limit: number = 50): Promise<PositionWithTrades[]> {
    const result = await this.prisma.position.findMany({
      where: { status: 'CLOSED' },
      include: { trades: true },
      orderBy: { closedAt: 'desc' },
      take: limit,
    });
    return result as unknown as PositionWithTrades[];
  }

  async findByToken(token: string): Promise<PositionWithTrades[]> {
    const result = await this.prisma.position.findMany({
      where: { token },
      include: { trades: true },
      orderBy: { openedAt: 'desc' },
    });
    return result as unknown as PositionWithTrades[];
  }

  async updateCurrentPrice(id: string, currentPrice: number): Promise<Position | null> {
    const position = await this.prisma.position.findUnique({
      where: { id },
    });

    if (!position) return null;

    const entryPrice = Number(position.entryPrice);
    const pnl = ((currentPrice - entryPrice) / entryPrice) * 100;

    const result = await this.prisma.position.update({
      where: { id },
      data: { currentPrice, pnl },
    });
    return result as unknown as Position | null;
  }

  async closePosition(
    id: string,
    exitPrice: number,
    closeReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL' | 'TIMEOUT',
  ): Promise<PositionWithTrades> {
    const result = await this.prisma.position.update({
      where: { id },
      data: {
        currentPrice: exitPrice,
        status: 'CLOSED',
        closedAt: new Date(),
      },
      include: { trades: true },
    });
    return result as unknown as PositionWithTrades;
  }

  async countOpenPositions(): Promise<number> {
    return await this.prisma.position.count({
      where: { status: 'OPEN' },
    });
  }

  async hasOpenPositionForToken(token: string): Promise<boolean> {
    const count = await this.prisma.position.count({
      where: { token, status: 'OPEN' },
    });
    return count > 0;
  }
}
