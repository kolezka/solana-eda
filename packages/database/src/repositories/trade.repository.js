import { PrismaClient, Trade, Position } from '../generated/client';
export class TradeRepository {
  prisma;
  constructor(prisma) {
    this.prisma = prisma;
  }
  async create(data) {
    return await this.prisma.trade.create({
      data: {
        ...data,
        amount: data.amount,
        price: data.price,
        slippage: data.slippage,
      },
    });
  }
  async findById(id) {
    return await this.prisma.trade.findUnique({
      where: { id },
      include: { position: true },
    });
  }
  async findByPositionId(positionId) {
    return await this.prisma.trade.findMany({
      where: { positionId },
      orderBy: { timestamp: 'desc' },
    });
  }
  async findBySignature(signature) {
    return await this.prisma.trade.findUnique({
      where: { signature },
      include: { position: true },
    });
  }
  async findRecent(limit = 50) {
    return await this.prisma.trade.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: { position: true },
    });
  }
  async findTradesByType(type, limit = 50) {
    return await this.prisma.trade.findMany({
      where: { type },
      orderBy: { timestamp: 'desc' },
      take: limit,
      include: { position: true },
    });
  }
  async calculateTotalVolume(startDate, endDate) {
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
  async calculateWinRate(startDate, endDate) {
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
    const winningTrades = trades.filter((trade) => {
      return trade.position && Number(trade.position.pnl) > 0;
    });
    return (winningTrades.length / trades.length) * 100;
  }
  async countTradesInRange(startDate, endDate) {
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
