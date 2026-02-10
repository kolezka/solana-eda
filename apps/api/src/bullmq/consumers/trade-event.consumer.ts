/**
 * Trade Event Consumer for BullMQ
 * Processes TRADE_EXECUTED events
 */

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BaseEventConsumer } from './base-event.consumer';
import { TradeEventSchema, type AnyEvent } from '@solana-eda/events';

/**
 * Consumer for trade executed events
 * Handles validation and processing of trading activity
 */
@Injectable()
export class TradeEventConsumer extends BaseEventConsumer {
  constructor(eventEmitter: EventEmitter2) {
    super(eventEmitter, TradeEventConsumer.name);
  }

  getEventType(): string {
    return 'TRADE_EXECUTED';
  }

  /**
   * Process a validated trade event
   * Additional business logic can be added here (persistence, analytics, etc.)
   */
  async processEvent(event: AnyEvent): Promise<void> {
    // Validate using the specific schema
    const tradeEvent = TradeEventSchema.parse(event);

    this.logger.log(
      `Trade executed: ${tradeEvent.data.type} ${tradeEvent.data.amountIn} ` +
        `${tradeEvent.data.tokenIn} -> ${tradeEvent.data.amountOut} ${tradeEvent.data.tokenOut} ` +
        `at ${tradeEvent.data.price} (slippage: ${tradeEvent.data.slippage}%)`,
    );

    // TODO: Persist trade to database
    // TODO: Update position tracking
    // TODO: Calculate and update P&L
    // TODO: Send notifications for significant trades

    // The event is automatically emitted to EventEmitter2 by the base class
    // for WebSocket Gateway to broadcast to clients
  }
}
