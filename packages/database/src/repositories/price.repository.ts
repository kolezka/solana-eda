import { PrismaClient } from '@prisma/client';

export class PriceRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    token: string;
    price: number;
    source: string;
    confidence: number;
    volume24h?: number;
  }) {
    return await this.prisma.priceRecord.create({
      data: {
        token: data.token,
        price: data.price,
        source: data.source,
        confidence: data.confidence,
        volume24h: data.volume24h,
      },
    });
  }

  async findLatestByToken(token: string) {
    return await this.prisma.priceRecord.findFirst({
      where: { token },
      orderBy: { timestamp: 'desc' },
    });
  }

  async findByToken(token: string, limit: number = 100) {
    return await this.prisma.priceRecord.findMany({
      where: { token },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  async findByTokenInRange(
    token: string,
    start: Date,
    end: Date,
  ) {
    return await this.prisma.priceRecord.findMany({
      where: {
        token,
        timestamp: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  async cleanup(olderThanDays: number) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    return await this.prisma.priceRecord.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });
  }
}
