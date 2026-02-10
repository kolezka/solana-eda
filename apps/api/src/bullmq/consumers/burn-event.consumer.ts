/**
 * Burn Event Consumer for BullMQ
 * Processes BURN_DETECTED events
 */

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BaseEventConsumer } from './base-event.consumer';
import { BurnEventSchema, type AnyEvent } from '@solana-eda/events';

/**
 * Consumer for burn detected events
 * Handles validation and processing of token burn events
 */
@Injectable()
export class BurnEventConsumer extends BaseEventConsumer {
  constructor(eventEmitter: EventEmitter2) {
    super(eventEmitter, BurnEventConsumer.name);
  }

  getEventType(): string {
    return 'BURN_DETECTED';
  }

  /**
   * Process a validated burn event
   * Additional business logic can be added here (persistence, analytics, etc.)
   */
  async processEvent(event: AnyEvent): Promise<void> {
    // Validate using the specific schema
    const burnEvent = BurnEventSchema.parse(event);

    this.logger.debug(
      `Burn detected: ${burnEvent.data.amount} of token ${burnEvent.data.token} (${burnEvent.data.percentage}%)`,
    );

    // TODO: Add persistence to database if needed
    // TODO: Add analytics tracking
    // TODO: Trigger additional workflows

    // The event is automatically emitted to EventEmitter2 by the base class
    // for WebSocket Gateway to broadcast to clients
  }
}
