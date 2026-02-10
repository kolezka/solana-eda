/**
 * Price Event Consumer for BullMQ
 * Processes PRICE_UPDATE events
 */

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BaseEventConsumer } from './base-event.consumer';
import { PriceUpdateEventSchema, type AnyEvent } from '@solana-eda/events';

/**
 * Consumer for price update events
 * Handles validation and processing of token price updates
 */
@Injectable()
export class PriceEventConsumer extends BaseEventConsumer {
  constructor(eventEmitter: EventEmitter2) {
    super(eventEmitter, PriceEventConsumer.name);
  }

  getEventType(): string {
    return 'PRICE_UPDATE';
  }

  /**
   * Process a validated price update event
   * Additional business logic can be added here (persistence, analytics, etc.)
   */
  async processEvent(event: AnyEvent): Promise<void> {
    // Validate using the specific schema
    const priceEvent = PriceUpdateEventSchema.parse(event);

    this.logger.debug(
      `Price update for ${priceEvent.data.token}: ${priceEvent.data.price} ` +
        `(confidence: ${priceEvent.data.confidence}, source: ${priceEvent.data.source})`,
    );

    // Log price change if available
    if (priceEvent.data.priceChange24h !== undefined) {
      this.logger.debug(
        `24h price change: ${priceEvent.data.priceChange24h > 0 ? '+' : ''}${priceEvent.data.priceChange24h}%`,
      );
    }

    // TODO: Add persistence to database for price history
    // TODO: Update token price cache
    // TODO: Trigger alerts for significant price movements

    // The event is automatically emitted to EventEmitter2 by the base class
    // for WebSocket Gateway to broadcast to clients
  }
}
