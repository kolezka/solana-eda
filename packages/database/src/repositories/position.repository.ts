import { PrismaClient, Position, Trade } from '../generated/client';

type PositionWithTrades = Position & { trades: Trade[] };

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
    return await this.prisma.position.create({
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
  }

  async findById(id: string): Promise<(PositionWithTrades) | null> {
    return await this.prisma.position.findUnique({
      where: { id },
      include: { trades: true },
    });
  }

  async findOpenPositions(): Promise<(PositionWithTrades)[]> {
    return await this.prisma.position.findMany({
      where: { status: 'OPEN' },
      include: { trades: true },
      orderBy: { openedAt: 'desc' },
    });
  }

  async findClosedPositions(limit: number = 50): Promise<(PositionWithTrades)[]> {
    return await this.prisma.position.findMany({
      where: { status: 'CLOSED' },
      include: { trades: true },
      orderBy: { closedAt: 'desc' },
      take: limit,
    });
  }

  async findByToken(token: string): Promise<(PositionWithTrades)[]> {
    return await this.prisma.position.findMany({
      where: { token },
      include: { trades: true },
      orderBy: { openedAt: 'desc' },
    });
  }

  async updateCurrentPrice(id: string, currentPrice: number): Promise<Position | null> {
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
    closeReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL' | 'TIMEOUT',
  ): Promise<PositionWithTrades> {
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
