import { PrismaClient } from '@prisma/client';

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
  }) {
    return await this.prisma.position.create({
      data: data.accountId ? {
        token: data.token,
        amount: data.amount,
        entryPrice: data.entryPrice,
        currentPrice: data.currentPrice,
        stopLoss: data.stopLoss,
        takeProfit: data.takeProfit,
        accountId: data.accountId,
        status: 'OPEN',
      } : {
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
  }

  async findById(id: string) {
    return await this.prisma.position.findUnique({
      where: { id },
      include: { trades: true },
    });
  }

  async findOpenPositions() {
    return await this.prisma.position.findMany({
      where: { status: 'OPEN' },
      include: { trades: true },
      orderBy: { openedAt: 'desc' },
    });
  }

  async findClosedPositions(limit: number = 50) {
    return await this.prisma.position.findMany({
      where: { status: 'CLOSED' },
      include: { trades: true },
      orderBy: { closedAt: 'desc' },
      take: limit,
    });
  }

  async findByToken(token: string) {
    return await this.prisma.position.findMany({
      where: { token },
      include: { trades: true },
      orderBy: { openedAt: 'desc' },
    });
  }

  async updateCurrentPrice(id: string, currentPrice: number) {
    const position = await this.prisma.position.findUnique({
      where: { id },
    });

    if (!position) return null;

    const entryPrice = Number(position.entryPrice);
    const pnl = ((currentPrice - entryPrice) / entryPrice) * 100;

    return await this.prisma.position.update({
      where: { id },
      data: { currentPrice, pnl },
    });
  }

  async closePosition(
    id: string,
    exitPrice: number,
    closeReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL' | 'TIMEOUT'
  ) {
    return await this.prisma.position.update({
      where: { id },
      data: {
        currentPrice: exitPrice,
        status: 'CLOSED',
        closedAt: new Date(),
      },
      include: { trades: true },
    });
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
