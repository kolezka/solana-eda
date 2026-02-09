import { PrismaClient, MarketRecord } from '../generated/client';

export interface MarketData {
  address: string;
  baseMint: string;
  quoteMint: string;
  dexType: 'OPENBOOK' | 'RAYDIUM' | 'ORCA' | 'METEORA';
  discoveredAt?: Date;
  status?: 'DISCOVERED' | 'VALIDATING' | 'VALIDATED' | 'REJECTED';
  validations?: any;
  marketData?: any;
}

export class MarketRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: MarketData): Promise<MarketRecord> {
    return await this.prisma.marketRecord.create({
      data: {
        ...data,
        discoveredAt: data.discoveredAt ?? new Date(),
        status: data.status ?? 'DISCOVERED',
      },
    });
  }

  async findByAddress(address: string): Promise<MarketRecord | null> {
    return await this.prisma.marketRecord.findUnique({
      where: { address },
    });
  }

  async findByBaseMint(baseMint: string, limit: number = 20): Promise<MarketRecord[]> {
    return await this.prisma.marketRecord.findMany({
      where: { baseMint },
      orderBy: { discoveredAt: 'desc' },
      take: limit,
    });
  }

  async findByQuoteMint(quoteMint: string, limit: number = 20): Promise<MarketRecord[]> {
    return await this.prisma.marketRecord.findMany({
      where: { quoteMint },
      orderBy: { discoveredAt: 'desc' },
      take: limit,
    });
  }

  async findByDexType(dexType: string, limit: number = 50): Promise<MarketRecord[]> {
    return await this.prisma.marketRecord.findMany({
      where: { dexType },
      orderBy: { discoveredAt: 'desc' },
      take: limit,
    });
  }

  async findByStatus(status: string, limit: number = 50): Promise<MarketRecord[]> {
    return await this.prisma.marketRecord.findMany({
      where: { status },
      orderBy: { discoveredAt: 'desc' },
      take: limit,
    });
  }

  async upsert(data: MarketData): Promise<MarketRecord> {
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

  async updateStatus(
    address: string,
    status: 'DISCOVERED' | 'VALIDATING' | 'VALIDATED' | 'REJECTED',
  ): Promise<MarketRecord> {
    return await this.prisma.marketRecord.update({
      where: { address },
      data: { status },
    });
  }

  async updateValidations(address: string, validations: any): Promise<MarketRecord> {
    return await this.prisma.marketRecord.update({
      where: { address },
      data: { validations },
    });
  }

  async findRecent(limit: number = 50): Promise<MarketRecord[]> {
    return await this.prisma.marketRecord.findMany({
      orderBy: { discoveredAt: 'desc' },
      take: limit,
    });
  }

  async deleteOlderThan(days: number): Promise<{ count: number }> {
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
