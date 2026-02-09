import { PrismaClient, DiscoveredPool } from '../generated/client';

export interface DiscoveredPoolData {
  address: string;
  dexType: 'RAYDIUM' | 'ORCA' | 'METEORA';
  tokenA: string;
  tokenB: string;
  initialTvl: number | string | bigint;
  discoveredAt?: Date;
  status?: 'MONITORING' | 'IGNORED' | 'ERROR';
  poolData?: any;
}

export class DiscoveredPoolRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: DiscoveredPoolData): Promise<DiscoveredPool> {
    return await this.prisma.discoveredPool.create({
      data: {
        ...data,
        initialTvl: typeof data.initialTvl === 'number' ? data.initialTvl : String(data.initialTvl),
        discoveredAt: data.discoveredAt ?? new Date(),
        status: data.status ?? 'MONITORING',
      },
    });
  }

  async findByAddress(address: string): Promise<DiscoveredPool | null> {
    return await this.prisma.discoveredPool.findUnique({
      where: { address },
    });
  }

  async findByTokenA(tokenA: string, limit: number = 20): Promise<DiscoveredPool[]> {
    return await this.prisma.discoveredPool.findMany({
      where: { tokenA },
      orderBy: { discoveredAt: 'desc' },
      take: limit,
    });
  }

  async findByTokenB(tokenB: string, limit: number = 20): Promise<DiscoveredPool[]> {
    return await this.prisma.discoveredPool.findMany({
      where: { tokenB },
      orderBy: { discoveredAt: 'desc' },
      take: limit,
    });
  }

  async findByTokenPair(tokenA: string, tokenB: string): Promise<DiscoveredPool[]> {
    return await this.prisma.discoveredPool.findMany({
      where: {
        OR: [{ AND: [{ tokenA }, { tokenB }] }, { AND: [{ tokenA: tokenB }, { tokenB: tokenA }] }],
      },
      orderBy: { discoveredAt: 'desc' },
    });
  }

  async findByDexType(dexType: string, limit: number = 50): Promise<DiscoveredPool[]> {
    return await this.prisma.discoveredPool.findMany({
      where: { dexType },
      orderBy: { discoveredAt: 'desc' },
      take: limit,
    });
  }

  async findByStatus(status: string, limit: number = 50): Promise<DiscoveredPool[]> {
    return await this.prisma.discoveredPool.findMany({
      where: { status },
      orderBy: { discoveredAt: 'desc' },
      take: limit,
    });
  }

  async upsert(data: DiscoveredPoolData): Promise<DiscoveredPool> {
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

  async updateStatus(
    address: string,
    status: 'MONITORING' | 'IGNORED' | 'ERROR',
  ): Promise<DiscoveredPool> {
    return await this.prisma.discoveredPool.update({
      where: { address },
      data: { status },
    });
  }

  async findRecent(limit: number = 50): Promise<DiscoveredPool[]> {
    return await this.prisma.discoveredPool.findMany({
      orderBy: { discoveredAt: 'desc' },
      take: limit,
    });
  }

  async findHighTvl(minTvl: number, limit: number = 50): Promise<DiscoveredPool[]> {
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

  async deleteOlderThan(days: number): Promise<{ count: number }> {
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
