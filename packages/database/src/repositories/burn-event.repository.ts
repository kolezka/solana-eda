import { PrismaClient, BurnEventRecord } from '../generated/client';

export class BurnEventRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: { txSignature: string; token: string; amount: number; percentage: number }): Promise<BurnEventRecord> {
    return await this.prisma.burnEventRecord.create({
      data: {
        ...data,
        amount: data.amount,
      },
    });
  }

  async findBySignature(signature: string): Promise<BurnEventRecord | null> {
    return await this.prisma.burnEventRecord.findUnique({
      where: { txSignature: signature },
    });
  }

  async findUnprocessed(limit: number = 100): Promise<BurnEventRecord[]> {
    return await this.prisma.burnEventRecord.findMany({
      where: { processed: false },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  async markAsProcessed(id: string): Promise<BurnEventRecord> {
    return await this.prisma.burnEventRecord.update({
      where: { id },
      data: { processed: true },
    });
  }

  async findRecent(limit: number = 50): Promise<BurnEventRecord[]> {
    return await this.prisma.burnEventRecord.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  async findByToken(token: string, limit: number = 20): Promise<BurnEventRecord[]> {
    return await this.prisma.burnEventRecord.findMany({
      where: { token },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  async deleteOlderThan(days: number): Promise<{ count: number }> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return await this.prisma.burnEventRecord.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
        processed: true,
      },
    });
  }
}
