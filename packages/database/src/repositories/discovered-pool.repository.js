import { PrismaClient, DiscoveredPool } from '../generated/client';
export class DiscoveredPoolRepository {
  prisma;
  constructor(prisma) {
    this.prisma = prisma;
  }
  async create(data) {
    return await this.prisma.discoveredPool.create({
      data: {
        ...data,
        initialTvl: typeof data.initialTvl === 'number' ? data.initialTvl : String(data.initialTvl),
        discoveredAt: data.discoveredAt ?? new Date(),
        status: data.status ?? 'MONITORING',
      },
    });
  }
  async findByAddress(address) {
    return await this.prisma.discoveredPool.findUnique({
      where: { address },
    });
  }
  async findByTokenA(tokenA, limit = 20) {
    return await this.prisma.discoveredPool.findMany({
      where: { tokenA },
      orderBy: { discoveredAt: 'desc' },
      take: limit,
    });
  }
  async findByTokenB(tokenB, limit = 20) {
    return await this.prisma.discoveredPool.findMany({
      where: { tokenB },
      orderBy: { discoveredAt: 'desc' },
      take: limit,
    });
  }
  async findByTokenPair(tokenA, tokenB) {
    return await this.prisma.discoveredPool.findMany({
      where: {
        OR: [{ AND: [{ tokenA }, { tokenB }] }, { AND: [{ tokenA: tokenB }, { tokenB: tokenA }] }],
      },
      orderBy: { discoveredAt: 'desc' },
    });
  }
  async findByDexType(dexType, limit = 50) {
    return await this.prisma.discoveredPool.findMany({
      where: { dexType },
      orderBy: { discoveredAt: 'desc' },
      take: limit,
    });
  }
  async findByStatus(status, limit = 50) {
    return await this.prisma.discoveredPool.findMany({
      where: { status },
      orderBy: { discoveredAt: 'desc' },
      take: limit,
    });
  }
  async upsert(data) {
    return await this.prisma.discoveredPool.upsert({
      where: { address: data.address },
      update: {
        status: data.status,
        poolData: data.poolData,
      },
      create: {
        ...data,
        initialTvl: typeof data.initialTvl === 'number' ? data.initialTvl : String(data.initialTvl),
        discoveredAt: data.discoveredAt ?? new Date(),
        status: data.status ?? 'MONITORING',
      },
    });
  }
  async updateStatus(address, status) {
    return await this.prisma.discoveredPool.update({
      where: { address },
      data: { status },
    });
  }
  async findRecent(limit = 50) {
    return await this.prisma.discoveredPool.findMany({
      orderBy: { discoveredAt: 'desc' },
      take: limit,
    });
  }
  async findHighTvl(minTvl, limit = 50) {
    return await this.prisma.discoveredPool.findMany({
      where: {
        initialTvl: {
          gte: minTvl,
        },
      },
      orderBy: { initialTvl: 'desc' },
      take: limit,
    });
  }
  async deleteOlderThan(days) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    return await this.prisma.discoveredPool.deleteMany({
      where: {
        discoveredAt: {
          lt: cutoffDate,
        },
        status: 'ERROR',
      },
    });
  }
}
