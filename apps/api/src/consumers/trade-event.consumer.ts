import { Injectable } from '@nestjs/common';
import { BaseEventConsumer } from './base/base-event.consumer';
import { QUEUES, type EventEnvelope } from '@solana-eda/rabbitmq';
import type { AnyEvent } from '@solana-eda/events';
import { isTradeEvent } from '@solana-eda/events';

/**
 * Consumer for TRADE_EXECUTED events
 * Records all trading activity and updates positions
 */
@Injectable()
export class TradeEventConsumer extends BaseEventConsumer {
  protected async processEvent(event: AnyEvent, envelope: EventEnvelope): Promise<void> {
    if (!isTradeEvent(event)) {
      throw new Error(`Invalid event type for TradeEventConsumer: ${event.type}`);
    }

    const startTime = Date.now();

    await this.persistWithRetry(async () => {
      const existing = await this.prisma.trade.findUnique({
        where: { signature: event.data.txSignature },
      });

      if (existing) {
        this.logger.debug(`Duplicate trade ${event.data.tradeId}, skipping`);
        return;
      }

      await this.prisma.trade.create({
        data: {
          signature: event.data.txSignature,
          positionId: event.data.positionId,
          type: event.data.type,
          amount: event.data.amountIn,
          price: event.data.price,
          slippage: event.data.slippage,
          timestamp: new Date(event.timestamp),
        },
      });

      this.logger.debug(`Trade event persisted: ${event.data.tradeId}`);
    });

    this.logProcessingMetrics(event.type, Date.now() - startTime);
  }

  protected getQueueName(): string {
    return QUEUES.TRADE_EVENTS;
  }
}
