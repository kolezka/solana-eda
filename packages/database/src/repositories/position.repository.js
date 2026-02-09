import { PrismaClient, Position, Trade } from '../generated/client';
export class PositionRepository {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(data) {
        return await this.prisma.position.create({
            data: data.accountId
                ? {
                    token: data.token,
                    amount: data.amount,
                    entryPrice: data.entryPrice,
                    currentPrice: data.currentPrice,
                    stopLoss: data.stopLoss,
                    takeProfit: data.takeProfit,
                    accountId: data.accountId,
                    status: 'OPEN',
                }
                : {
                    token: data.token,
                    amount: data.amount,
                    entryPrice: data.entryPrice,
                    currentPrice: data.currentPrice,
                    stopLoss: data.stopLoss,
                    takeProfit: data.takeProfit,
                    status: 'OPEN',
                },
            include: { trades: true },
        });
    }
    async findById(id) {
        return await this.prisma.position.findUnique({
            where: { id },
            include: { trades: true },
        });
    }
    async findOpenPositions() {
        return await this.prisma.position.findMany({
            where: { status: 'OPEN' },
            include: { trades: true },
            orderBy: { openedAt: 'desc' },
        });
    }
    async findClosedPositions(limit = 50) {
        return await this.prisma.position.findMany({
            where: { status: 'CLOSED' },
            include: { trades: true },
            orderBy: { closedAt: 'desc' },
            take: limit,
        });
    }
    async findByToken(token) {
        return await this.prisma.position.findMany({
            where: { token },
            include: { trades: true },
            orderBy: { openedAt: 'desc' },
        });
    }
    async updateCurrentPrice(id, currentPrice) {
        const position = await this.prisma.position.findUnique({
            where: { id },
        });
        if (!position)
            return null;
        const entryPrice = Number(position.entryPrice);
        const pnl = ((currentPrice - entryPrice) / entryPrice) * 100;
        return await this.prisma.position.update({
            where: { id },
            data: { currentPrice, pnl },
        });
    }
    async closePosition(id, exitPrice, closeReason) {
        return await this.prisma.position.update({
            where: { id },
            data: {
                currentPrice: exitPrice,
                status: 'CLOSED',
                closedAt: new Date(),
            },
            include: { trades: true },
        });
    }
    async countOpenPositions() {
        return await this.prisma.position.count({
            where: { status: 'OPEN' },
        });
    }
    async hasOpenPositionForToken(token) {
        const count = await this.prisma.position.count({
            where: { token, status: 'OPEN' },
        });
        return count > 0;
    }
}
