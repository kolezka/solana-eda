import { Injectable } from '@nestjs/common';
import { BaseEventConsumer } from './base/base-event.consumer';
import { QUEUES, type EventEnvelope } from '@solana-eda/rabbitmq';
import type { AnyEvent } from '@solana-eda/events';
import { isPriceUpdateEvent } from '@solana-eda/events';

/**
 * Consumer for PRICE_UPDATE events
 * Tracks token prices and market data
 */
@Injectable()
export class PriceEventConsumer extends BaseEventConsumer {
  protected async processEvent(event: AnyEvent, envelope: EventEnvelope): Promise<void> {
    if (!isPriceUpdateEvent(event)) {
      throw new Error(`Invalid event type for PriceEventConsumer: ${event.type}`);
    }

    const startTime = Date.now();

    await this.persistWithRetry(async () => {
      // Store price in database using PriceRecord model
      await this.prisma.priceRecord.create({
        data: {
          id: event.id,
          token: event.data.token,
          price: event.data.price,
          source: event.data.source,
          confidence: event.data.confidence,
          volume24h: event.data.volume24h,
          timestamp: new Date(event.timestamp),
        },
      }).catch(err => {
        // Ignore duplicate key errors
        if (err.code !== 'P2002') {
          throw err;
        }
      });

      this.logger.debug(`Price update persisted: ${event.data.token} @ ${event.data.price}`);
    });

    this.logProcessingMetrics(event.type, Date.now() - startTime);
  }

  protected getQueueName(): string {
    return QUEUES.PRICE_EVENTS;
  }
}
