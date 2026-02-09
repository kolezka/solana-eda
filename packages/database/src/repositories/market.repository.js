import { PrismaClient, MarketRecord } from '../generated/client';
export class MarketRepository {
  prisma;
  constructor(prisma) {
    this.prisma = prisma;
  }
  async create(data) {
    return await this.prisma.marketRecord.create({
      data: {
        ...data,
        discoveredAt: data.discoveredAt ?? new Date(),
        status: data.status ?? 'DISCOVERED',
      },
    });
  }
  async findByAddress(address) {
    return await this.prisma.marketRecord.findUnique({
      where: { address },
    });
  }
  async findByBaseMint(baseMint, limit = 20) {
    return await this.prisma.marketRecord.findMany({
      where: { baseMint },
      orderBy: { discoveredAt: 'desc' },
      take: limit,
    });
  }
  async findByQuoteMint(quoteMint, limit = 20) {
    return await this.prisma.marketRecord.findMany({
      where: { quoteMint },
      orderBy: { discoveredAt: 'desc' },
      take: limit,
    });
  }
  async findByDexType(dexType, limit = 50) {
    return await this.prisma.marketRecord.findMany({
      where: { dexType },
      orderBy: { discoveredAt: 'desc' },
      take: limit,
    });
  }
  async findByStatus(status, limit = 50) {
    return await this.prisma.marketRecord.findMany({
      where: { status },
      orderBy: { discoveredAt: 'desc' },
      take: limit,
    });
  }
  async upsert(data) {
    return await this.prisma.marketRecord.upsert({
      where: { address: data.address },
      update: {
        status: data.status,
        validations: data.validations,
        marketData: data.marketData,
      },
      create: {
        ...data,
        discoveredAt: data.discoveredAt ?? new Date(),
        status: data.status ?? 'DISCOVERED',
      },
    });
  }
  async updateStatus(address, status) {
    return await this.prisma.marketRecord.update({
      where: { address },
      data: { status },
    });
  }
  async updateValidations(address, validations) {
    return await this.prisma.marketRecord.update({
      where: { address },
      data: { validations },
    });
  }
  async findRecent(limit = 50) {
    return await this.prisma.marketRecord.findMany({
      orderBy: { discoveredAt: 'desc' },
      take: limit,
    });
  }
  async deleteOlderThan(days) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    return await this.prisma.marketRecord.deleteMany({
      where: {
        discoveredAt: {
          lt: cutoffDate,
        },
        status: 'REJECTED',
      },
    });
  }
}
