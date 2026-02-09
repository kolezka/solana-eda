import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { TradeSettingsRepository, TradeRepository } from '@solana-eda/database';
import type { TradeSettings, TradeWithPosition } from '@solana-eda/database';
import { PrismaService } from '../../prisma/prisma.service';

interface VolumeStats {
  period: string;
  totalVolume: number;
  winRate: number;
  tradeCount: number;
}

@Injectable()
export class TradingService {
  constructor(@Inject('PRISMA') private prisma: PrismaService) {
    this.settingsRepo = new TradeSettingsRepository(this.prisma);
    this.tradeRepo = new TradeRepository(this.prisma);
  }

  private settingsRepo: TradeSettingsRepository;
  private tradeRepo: TradeRepository;

  async getSettings(): Promise<TradeSettings[]> {
    return await this.settingsRepo.findAll();
  }

  async getEnabledSettings(): Promise<TradeSettings[]> {
    return await this.settingsRepo.findEnabled();
  }

  async getSettingsByName(name: string): Promise<TradeSettings | null> {
    return await this.settingsRepo.findByName(name);
  }

  async updateSettings(id: string, data: any): Promise<TradeSettings> {
    return await this.settingsRepo.update(id, data);
  }

  async toggleEnabled(id: string): Promise<TradeSettings | null> {
    return await this.settingsRepo.toggleEnabled(id);
  }

  async getTrades(limit: number = 50): Promise<TradeWithPosition[]> {
    return await this.tradeRepo.findRecent(limit);
  }

  async getBuyTrades(limit: number = 50): Promise<TradeWithPosition[]> {
    return await this.tradeRepo.findTradesByType('BUY', limit);
  }

  async getSellTrades(limit: number = 50): Promise<TradeWithPosition[]> {
    return await this.tradeRepo.findTradesByType('SELL', limit);
  }

  async getVolumeStats(days: number = 7): Promise<VolumeStats> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const endDate = new Date();

    const totalVolume = await this.tradeRepo.calculateTotalVolume(startDate, endDate);
    const winRate = await this.tradeRepo.calculateWinRate(startDate, endDate);
    const tradeCount = await this.tradeRepo.countTradesInRange(startDate, endDate);

    return {
      period: `${days} days`,
      totalVolume,
      winRate,
      tradeCount,
    };
  }
}
