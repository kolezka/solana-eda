import { PrismaClient, TradeSettings } from '../generated/client';

export class TradeSettingsRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: {
    name: string;
    enabled?: boolean;
    maxSlippage?: number;
    maxPositions?: number;
    stopLossPercent?: number;
    takeProfitPercent?: number;
    minBurnAmount?: number;
  }): Promise<TradeSettings> {
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

  async findById(id: string): Promise<TradeSettings | null> {
    return await this.prisma.tradeSettings.findUnique({
      where: { id },
    });
  }

  async findByName(name: string): Promise<TradeSettings | null> {
    return await this.prisma.tradeSettings.findUnique({
      where: { name },
    });
  }

  async findEnabled(): Promise<TradeSettings[]> {
    return await this.prisma.tradeSettings.findMany({
      where: { enabled: true },
    });
  }

  async findAll(): Promise<TradeSettings[]> {
    return await this.prisma.tradeSettings.findMany();
  }

  async update(
    id: string,
    data: Partial<{
      enabled: boolean;
      maxSlippage: number;
      maxPositions: number;
      stopLossPercent: number;
      takeProfitPercent: number;
      minBurnAmount: number;
    }>,
  ): Promise<TradeSettings> {
    return await this.prisma.tradeSettings.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    });
  }

  async updateByName(
    name: string,
    data: Partial<{
      enabled: boolean;
      maxSlippage: number;
      maxPositions: number;
      stopLossPercent: number;
      takeProfitPercent: number;
      minBurnAmount: number;
    }>,
  ): Promise<TradeSettings> {
    return await this.prisma.tradeSettings.update({
      where: { name },
      data: { ...data, updatedAt: new Date() },
    });
  }

  async toggleEnabled(id: string): Promise<TradeSettings | null> {
    const settings = await this.findById(id);
    if (!settings) return null;

    return await this.prisma.tradeSettings.update({
      where: { id },
      data: { enabled: !settings.enabled, updatedAt: new Date() },
    });
  }
}
