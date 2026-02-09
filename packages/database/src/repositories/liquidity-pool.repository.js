import { PrismaClient, LiquidityPoolRecord } from '../generated/client';
export class LiquidityPoolRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async upsert(data) {
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
    async findByAddress(address) {
        return await this.prisma.liquidityPoolRecord.findUnique({
            where: { address },
        });
    }
    async findAll(limit = 50) {
        return await this.prisma.liquidityPoolRecord.findMany({
            orderBy: { updatedAt: 'desc' },
            take: limit,
        });
    }
    async findByTokenPair(tokenA, tokenB) {
        return await this.prisma.liquidityPoolRecord.findFirst({
            where: {
                OR: [
                    { tokenA, tokenB },
                    { tokenA: tokenB, tokenB: tokenA },
                ],
            },
        });
    }
    async findHighVolumePools(minVolume = 10000, limit = 20) {
        return await this.prisma.liquidityPoolRecord.findMany({
            where: { volume24h: { gte: minVolume } },
            orderBy: { volume24h: 'desc' },
            take: limit,
        });
    }
}
