import type { PrismaClient } from '../generated/client';
import type { TradeSettings } from '../types';

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
    const result = await this.prisma.tradeSettings.create({
      data: {
        ...data,
        maxSlippage: data.maxSlippage || 0.03,
        maxPositions: data.maxPositions || 5,
        stopLossPercent: data.stopLossPercent || 0.1,
        takeProfitPercent: data.takeProfitPercent || 0.5,
        minBurnAmount: data.minBurnAmount || 1000,
      },
    });
    return result as unknown as TradeSettings;
  }

  async findById(id: string): Promise<TradeSettings | null> {
    const result = await this.prisma.tradeSettings.findUnique({
      where: { id },
    });
    return result as TradeSettings | null;
  }

  async findByName(name: string): Promise<TradeSettings | null> {
    const result = await this.prisma.tradeSettings.findUnique({
      where: { name },
    });
    return result as TradeSettings | null;
  }

  async findEnabled(): Promise<TradeSettings[]> {
    const result = await this.prisma.tradeSettings.findMany({
      where: { enabled: true },
    });
    return result as unknown as TradeSettings[];
  }

  async findAll(): Promise<TradeSettings[]> {
    const result = await this.prisma.tradeSettings.findMany();
    return result as unknown as TradeSettings[];
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
    const result = await this.prisma.tradeSettings.update({
      where: { id },
      data: { ...data, updatedAt: new Date() },
    });
    return result as unknown as TradeSettings;
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
    const result = await this.prisma.tradeSettings.update({
      where: { name },
      data: { ...data, updatedAt: new Date() },
    });
    return result as unknown as TradeSettings;
  }

  async toggleEnabled(id: string): Promise<TradeSettings | null> {
    const settings = await this.findById(id);
    if (!settings) return null;

    const result = await this.prisma.tradeSettings.update({
      where: { id },
      data: { enabled: !settings.enabled, updatedAt: new Date() },
    });
    return result as unknown as TradeSettings;
  }
}
