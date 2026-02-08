import { PrismaClient, PriceRecord } from '../generated/client';

export class PriceRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    token: string;
    price: number;
    source: string;
    confidence: number;
    volume24h?: number;
  }): Promise<PriceRecord> {
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

  async findLatestByToken(token: string): Promise<PriceRecord | null> {
    return await this.prisma.priceRecord.findFirst({
      where: { token },
      orderBy: { timestamp: 'desc' },
    });
  }

  async findByToken(token: string, limit: number = 100): Promise<PriceRecord[]> {
    return await this.prisma.priceRecord.findMany({
      where: { token },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  async findByTokenInRange(token: string, start: Date, end: Date): Promise<PriceRecord[]> {
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

  async cleanup(olderThanDays: number): Promise<{ count: number }> {
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
