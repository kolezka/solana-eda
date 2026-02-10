/**
 * Position Event Consumer for BullMQ
 * Processes POSITION_OPENED and POSITION_CLOSED events
 */

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BaseEventConsumer } from './base-event.consumer';
import {
  PositionOpenedEventSchema,
  PositionClosedEventSchema,
  type AnyEvent,
} from '@solana-eda/events';

/**
 * Consumer for position events
 * Handles validation and processing of position lifecycle events
 */
@Injectable()
export class PositionEventConsumer extends BaseEventConsumer {
  constructor(eventEmitter: EventEmitter2) {
    super(eventEmitter, PositionEventConsumer.name);
  }

  getEventType(): string[] {
    // This consumer handles both position opened and closed events
    return ['POSITION_OPENED', 'POSITION_CLOSED'];
  }

  /**
   * Process a validated position event
   * Handles both POSITION_OPENED and POSITION_CLOSED events
   */
  async processEvent(event: AnyEvent): Promise<void> {
    if (event.type === 'POSITION_OPENED') {
      await this.processPositionOpened(event);
    } else if (event.type === 'POSITION_CLOSED') {
      await this.processPositionClosed(event);
    } else {
      this.logger.warn(`Unknown position event type: ${event.type}`);
    }
  }

  /**
   * Process position opened event
   */
  private async processPositionOpened(event: AnyEvent): Promise<void> {
    const positionEvent = PositionOpenedEventSchema.parse(event);

    this.logger.log(
      `Position opened: ${positionEvent.data.positionId} - ` +
        `${positionEvent.data.amount} ${positionEvent.data.token} @ ${positionEvent.data.entryPrice}`,
    );

    // Log stop loss and take profit if set
    if (positionEvent.data.stopLoss) {
      this.logger.debug(`  Stop loss: ${positionEvent.data.stopLoss}`);
    }
    if (positionEvent.data.takeProfit) {
      this.logger.debug(`  Take profit: ${positionEvent.data.takeProfit}`);
    }

    // TODO: Persist position to database
    // TODO: Track open positions
    // TODO: Set up monitoring for stop loss/take profit triggers

    // The event is automatically emitted to EventEmitter2 by the base class
    // for WebSocket Gateway to broadcast to clients
  }

  /**
   * Process position closed event
   */
  private async processPositionClosed(event: AnyEvent): Promise<void> {
    const positionEvent = PositionClosedEventSchema.parse(event);

    const pnlEmoji = positionEvent.data.pnlPercent >= 0 ? '+' : '';
    this.logger.log(
      `Position closed: ${positionEvent.data.positionId} - ` +
        `P&L: ${positionEvent.data.pnl} (${pnlEmoji}${positionEvent.data.pnlPercent}%) ` +
        `held for ${Math.floor(positionEvent.data.holdDuration / 60000)}min ` +
        `reason: ${positionEvent.data.closeReason}`,
    );

    // TODO: Update position record in database
    // TODO: Calculate and store final P&L
    // TODO: Update trading statistics
    // TODO: Send notifications for significant wins/losses

    // The event is automatically emitted to EventEmitter2 by the base class
    // for WebSocket Gateway to broadcast to clients
  }
}
