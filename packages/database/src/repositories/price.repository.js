import { PrismaClient, PriceRecord } from '../generated/client';
export class PriceRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(data) {
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
    async findLatestByToken(token) {
        return await this.prisma.priceRecord.findFirst({
            where: { token },
            orderBy: { timestamp: 'desc' },
        });
    }
    async findByToken(token, limit = 100) {
        return await this.prisma.priceRecord.findMany({
            where: { token },
            orderBy: { timestamp: 'desc' },
            take: limit,
        });
    }
    async findByTokenInRange(token, start, end) {
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
    async cleanup(olderThanDays) {
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
