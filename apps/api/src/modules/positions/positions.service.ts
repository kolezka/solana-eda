import { Injectable } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { PositionRepository } from '@solana-eda/database';
import type { Position, PositionWithTrades } from '@solana-eda/database';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PositionsService {
  constructor(@Inject('PRISMA') private prisma: PrismaService) {
    this.positionRepo = new PositionRepository(this.prisma);
  }

  private positionRepo: PositionRepository;

  async getAllPositions(): Promise<PositionWithTrades[]> {
    return this.positionRepo.findOpenPositions();
  }

  async getOpenPositions(): Promise<PositionWithTrades[]> {
    return await this.positionRepo.findOpenPositions();
  }

  async getClosedPositions(limit: number = 50): Promise<PositionWithTrades[]> {
    return await this.positionRepo.findClosedPositions(limit);
  }

  async getPositionById(id: string): Promise<PositionWithTrades | null> {
    return await this.positionRepo.findById(id);
  }

  async getPositionsByToken(token: string): Promise<PositionWithTrades[]> {
    return await this.positionRepo.findByToken(token);
  }

  async updatePositionPrice(id: string, currentPrice: number): Promise<Position | null> {
    return await this.positionRepo.updateCurrentPrice(id, currentPrice);
  }

  async closePosition(
    id: string,
    exitPrice: number,
    reason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL' | 'TIMEOUT',
  ): Promise<PositionWithTrades> {
    return await this.positionRepo.closePosition(id, exitPrice, reason);
  }

  async getOpenPositionCount(): Promise<number> {
    return await this.positionRepo.countOpenPositions();
  }

  async getPortfolioStats() {
    const positions = await this.positionRepo.findOpenPositions();

    let totalValue = 0;
    let totalPnl = 0;
    let winningPositions = 0;
    let losingPositions = 0;

    for (const position of positions) {
      const value = Number(position.amount) * Number(position.currentPrice);
      totalValue += value;
      totalPnl += Number(position.pnl);

      if (Number(position.pnl) > 0) {
        winningPositions++;
      } else {
        losingPositions++;
      }
    }

    const avgPnl = positions.length > 0 ? totalPnl / positions.length : 0;

    return {
      totalPositions: positions.length,
      totalValue,
      totalPnl,
      avgPnl,
      winningPositions,
      losingPositions,
    };
  }
}
