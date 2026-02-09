import { PrismaClient, BurnEventRecord } from '../generated/client';
export class BurnEventRepository {
  prisma;
  constructor(prisma) {
    this.prisma = prisma;
  }
  async create(data) {
    return await this.prisma.burnEventRecord.create({
      data: {
        ...data,
        amount: data.amount,
      },
    });
  }
  async findBySignature(signature) {
    return await this.prisma.burnEventRecord.findUnique({
      where: { txSignature: signature },
    });
  }
  async findUnprocessed(limit = 100) {
    return await this.prisma.burnEventRecord.findMany({
      where: { processed: false },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }
  async markAsProcessed(id) {
    return await this.prisma.burnEventRecord.update({
      where: { id },
      data: { processed: true },
    });
  }
  async findRecent(limit = 50) {
    return await this.prisma.burnEventRecord.findMany({
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }
  async findByToken(token, limit = 20) {
    return await this.prisma.burnEventRecord.findMany({
      where: { token },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }
  async deleteOlderThan(days) {
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
