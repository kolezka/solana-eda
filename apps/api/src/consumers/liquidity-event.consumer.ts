import { Injectable } from '@nestjs/common';
import { BaseEventConsumer } from './base/base-event.consumer';
import { QUEUES, type EventEnvelope } from '@solana-eda/rabbitmq';
import type { AnyEvent } from '@solana-eda/events';
import { isLiquidityEvent } from '@solana-eda/events';

/**
 * Consumer for LIQUIDITY_CHANGED events
 * Tracks liquidity changes in monitored pools
 */
@Injectable()
export class LiquidityEventConsumer extends BaseEventConsumer {
  protected async processEvent(event: AnyEvent, envelope: EventEnvelope): Promise<void> {
    if (!isLiquidityEvent(event)) {
      throw new Error(`Invalid event type for LiquidityEventConsumer: ${event.type}`);
    }

    const startTime = Date.now();

    await this.persistWithRetry(async () => {
      // Update or create liquidity pool record
      await this.prisma.liquidityPoolRecord.upsert({
        where: { address: event.data.poolAddress },
        update: {
          tvl: event.data.newTvl,
          price: event.data.price,
          volume24h: '0', // Would need to be calculated
          updatedAt: new Date(event.timestamp),
        },
        create: {
          id: event.id,
          address: event.data.poolAddress,
          tokenA: event.data.tokenA,
          tokenB: event.data.tokenB,
          tvl: event.data.newTvl,
          price: event.data.price,
          volume24h: '0',
        },
      });

      this.logger.debug(`Liquidity event persisted for pool: ${event.data.poolAddress}`);
    });

    this.logProcessingMetrics(event.type, Date.now() - startTime);
  }

  protected getQueueName(): string {
    return QUEUES.LIQUIDITY_EVENTS;
  }
}
