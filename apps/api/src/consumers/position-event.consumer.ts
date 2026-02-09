import { Injectable } from '@nestjs/common';
import { BaseEventConsumer } from './base/base-event.consumer';
import { QUEUES, type EventEnvelope } from '@solana-eda/rabbitmq';
import type { AnyEvent } from '@solana-eda/events';
import { isPositionOpenedEvent, isPositionClosedEvent } from '@solana-eda/events';

// Define local types for the position event data
interface PositionOpenedData {
  positionId: string;
  token: string;
  amount: string;
  entryPrice: string;
  stopLoss?: string;
  takeProfit?: string;
}

interface PositionClosedData {
  positionId: string;
  token: string;
  exitPrice: string;
  pnl: string;
  pnlPercent: number;
  holdDuration: number;
  closeReason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'MANUAL' | 'TIMEOUT';
}

/**
 * Consumer for POSITION_OPENED and POSITION_CLOSED events
 * Manages the lifecycle of trading positions
 */
@Injectable()
export class PositionEventConsumer extends BaseEventConsumer {
  protected async processEvent(event: AnyEvent, envelope: EventEnvelope): Promise<void> {
    const startTime = Date.now();

    await this.persistWithRetry(async () => {
      if (isPositionOpenedEvent(event)) {
        await this.handlePositionOpened(event);
      } else if (isPositionClosedEvent(event)) {
        await this.handlePositionClosed(event);
      } else {
        throw new Error(`Invalid event type for PositionEventConsumer: ${event.type}`);
      }
    });

    this.logProcessingMetrics(event.type, Date.now() - startTime);
  }

  private async handlePositionOpened(event: AnyEvent): Promise<void> {
    const data = event.data as PositionOpenedData;
    // Check if position exists
    const existing = await this.prisma.position.findFirst({
      where: {
        token: data.token,
        status: 'OPEN',
      },
    });

    // For now, just log the position opened event
    // In production, this would create/update the position
    this.logger.log(`Position opened: ${data.positionId} for token ${data.token}`);
  }

  private async handlePositionClosed(event: AnyEvent): Promise<void> {
    const data = event.data as PositionClosedData;
    // Find and close position
    const position = await this.prisma.position.findFirst({
      where: {
        token: data.token,
        status: 'OPEN',
      },
    });

    if (position) {
      await this.prisma.position.update({
        where: { id: position.id },
        data: {
          status: 'CLOSED',
          closedAt: new Date(event.timestamp),
          pnl: data.pnl,
        },
      });

      this.logger.log(`Position closed: ${position.id}`);
    } else {
      this.logger.warn(`No open position found for token ${data.token}`);
    }
  }

  protected getQueueName(): string {
    return QUEUES.POSITION_EVENTS;
  }
}
