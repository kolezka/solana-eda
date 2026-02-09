import { Injectable } from '@nestjs/common';
import { BaseEventConsumer } from './base/base-event.consumer';
import { QUEUES, type EventEnvelope } from '@solana-eda/rabbitmq';
import type { AnyEvent } from '@solana-eda/events';
import { isBurnEvent } from '@solana-eda/events';

/**
 * Consumer for BURN_DETECTED events
 * Persists burn events to database for tracking and analysis
 */
@Injectable()
export class BurnEventConsumer extends BaseEventConsumer {
  /**
   * Process burn event and persist to database
   */
  protected async processEvent(event: AnyEvent, envelope: EventEnvelope): Promise<void> {
    if (!isBurnEvent(event)) {
      throw new Error(`Invalid event type for BurnEventConsumer: ${event.type}`);
    }

    const startTime = Date.now();

    await this.persistWithRetry(async () => {
      // Check if event already exists (deduplication) by txSignature
      const existing = await this.prisma.burnEventRecord.findUnique({
        where: { txSignature: event.data.txSignature },
      });

      if (existing) {
        this.logger.debug(`Duplicate burn event ${event.id}, skipping`);
        return;
      }

      // Persist burn event to database using BurnEventRecord model
      await this.prisma.burnEventRecord.create({
        data: {
          id: event.id,
          txSignature: event.data.txSignature,
          token: event.data.token,
          amount: event.data.amount,
          percentage: event.data.percentage,
          timestamp: new Date(event.timestamp),
          processed: true,
        },
      });

      this.logger.debug(`Burn event persisted: ${event.id}`);
    });

    this.logProcessingMetrics(event.type, Date.now() - startTime);
  }

  /**
   * Get the queue name for this consumer
   */
  protected getQueueName(): string {
    return QUEUES.BURN_EVENTS;
  }
}
