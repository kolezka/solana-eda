import { PrismaClient } from '../generated/client';
import type { LiquidityPoolRecord } from '../generated/client';
export class LiquidityPoolRepository {
  constructor(private prisma: PrismaClient) {}

  async upsert(data: {
    address: string;
    tokenA: string;
    tokenB: string;
    tvl: number;
    price: number;
    volume24h: number;
  }): Promise<LiquidityPoolRecord> {
    return await this.prisma.liquidityPoolRecord.upsert({
      where: { address: data.address },
      update: {
        tvl: data.tvl,
        price: data.price,
        volume24h: data.volume24h,
        updatedAt: new Date(),
      },
      create: data,
    });
  }

  async findByAddress(address: string): Promise<LiquidityPoolRecord | null> {
    return await this.prisma.liquidityPoolRecord.findUnique({
      where: { address },
    });
  }

  async findAll(limit: number = 50): Promise<LiquidityPoolRecord[]> {
    return await this.prisma.liquidityPoolRecord.findMany({
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }

  async findByTokenPair(tokenA: string, tokenB: string): Promise<LiquidityPoolRecord | null> {
    return await this.prisma.liquidityPoolRecord.findFirst({
      where: {
        OR: [
          { tokenA, tokenB },
          { tokenA: tokenB, tokenB: tokenA },
        ],
      },
    });
  }

  async findHighVolumePools(
    minVolume: number = 10000,
    limit: number = 20,
  ): Promise<LiquidityPoolRecord[]> {
    return await this.prisma.liquidityPoolRecord.findMany({
      where: { volume24h: { gte: minVolume } },
      orderBy: { volume24h: 'desc' },
      take: limit,
    });
  }
}
