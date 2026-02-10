/**
 * Liquidity Event Consumer for BullMQ
 * Processes LIQUIDITY_CHANGED events
 */

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BaseEventConsumer } from './base-event.consumer';
import { LiquidityEventSchema, type AnyEvent } from '@solana-eda/events';

/**
 * Consumer for liquidity change events
 * Handles validation and processing of pool liquidity events
 */
@Injectable()
export class LiquidityEventConsumer extends BaseEventConsumer {
  constructor(eventEmitter: EventEmitter2) {
    super(eventEmitter, LiquidityEventConsumer.name);
  }

  getEventType(): string {
    return 'LIQUIDITY_CHANGED';
  }

  /**
   * Process a validated liquidity event
   * Additional business logic can be added here (persistence, analytics, etc.)
   */
  async processEvent(event: AnyEvent): Promise<void> {
    // Validate using the specific schema
    const liquidityEvent = LiquidityEventSchema.parse(event);

    this.logger.debug(
      `Liquidity changed in pool ${liquidityEvent.data.poolAddress}: ` +
        `${liquidityEvent.data.oldTvl} -> ${liquidityEvent.data.newTvl} ` +
        `(${liquidityEvent.data.changePercentage > 0 ? '+' : ''}${liquidityEvent.data.changePercentage}%)`,
    );

    // TODO: Add persistence to database if needed
    // TODO: Add analytics tracking for significant liquidity changes
    // TODO: Trigger alerts for large liquidity removals

    // The event is automatically emitted to EventEmitter2 by the base class
    // for WebSocket Gateway to broadcast to clients
  }
}
