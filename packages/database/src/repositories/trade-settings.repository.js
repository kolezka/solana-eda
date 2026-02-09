import { PrismaClient, TradeSettings } from '../generated/client';
export class TradeSettingsRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(data) {
        return await this.prisma.tradeSettings.create({
            data: {
                ...data,
                maxSlippage: data.maxSlippage || 0.03,
                maxPositions: data.maxPositions || 5,
                stopLossPercent: data.stopLossPercent || 0.1,
                takeProfitPercent: data.takeProfitPercent || 0.5,
                minBurnAmount: data.minBurnAmount || 1000,
            },
        });
    }
    async findById(id) {
        return await this.prisma.tradeSettings.findUnique({
            where: { id },
        });
    }
    async findByName(name) {
        return await this.prisma.tradeSettings.findUnique({
            where: { name },
        });
    }
    async findEnabled() {
        return await this.prisma.tradeSettings.findMany({
            where: { enabled: true },
        });
    }
    async findAll() {
        return await this.prisma.tradeSettings.findMany();
    }
    async update(id, data) {
        return await this.prisma.tradeSettings.update({
            where: { id },
            data: { ...data, updatedAt: new Date() },
        });
    }
    async updateByName(name, data) {
        return await this.prisma.tradeSettings.update({
            where: { name },
            data: { ...data, updatedAt: new Date() },
        });
    }
    async toggleEnabled(id) {
        const settings = await this.findById(id);
        if (!settings)
            return null;
        return await this.prisma.tradeSettings.update({
            where: { id },
            data: { enabled: !settings.enabled, updatedAt: new Date() },
        });
    }
}
