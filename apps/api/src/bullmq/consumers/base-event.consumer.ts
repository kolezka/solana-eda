/**
 * Base BullMQ Consumer for Solana EDA Events
 * Provides common functionality for all event consumers
 */

import { Logger, Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { AnyEvent, EventSchema } from '@solana-eda/events';
import { validateEvent } from '@solana-eda/events';

/**
 * Process result from a consumer
 */
export interface ConsumerResult {
  success: boolean;
  eventId: string;
  error?: string;
}

/**
 * Base consumer class that handles event validation, WebSocket publishing, and error handling
 */
@Injectable()
export abstract class BaseEventConsumer {
  protected readonly logger: Logger;
  protected readonly eventEmitter: EventEmitter2;

  constructor(eventEmitter: EventEmitter2, consumerName: string) {
    this.logger = new Logger(consumerName);
    this.eventEmitter = eventEmitter;
  }

  /**
   * Abstract method to be implemented by specific consumers
   * Returns the event type(s) this consumer handles
   * Can return a single string or an array of strings for consumers handling multiple event types
   */
  abstract getEventType(): string | string[];

  /**
   * Abstract method to be implemented by specific consumers
   * Processes the validated event data
   */
  abstract processEvent(event: AnyEvent): Promise<void>;

  /**
   * Main processor for BullMQ jobs
   * Handles validation, processing, and error handling
   */
  async process(job: Job): Promise<ConsumerResult> {
    const { eventType, eventId, timestamp, data } = job.data;

    try {
      // Validate event type matches this consumer
      const eventTypeValue = this.getEventType();
      const validTypes = Array.isArray(eventTypeValue) ? eventTypeValue : [eventTypeValue];
      if (!validTypes.includes(eventType)) {
        const expectedTypes = (validTypes as readonly string[]).join(' or ');
        this.logger.warn(
          `Event type mismatch: expected ${expectedTypes}, got ${eventType}. Skipping job ${job.id}.`,
        );
        return {
          success: false,
          eventId,
          error: `Event type mismatch: expected ${expectedTypes}, got ${eventType}`,
        };
      }

      // Validate event using Zod schema
      const eventData = { type: eventType, timestamp, id: eventId, eventId: job.data.eventId, data };
      const validatedEvent = validateEvent(eventData);

      this.logger.debug(
        `Processing ${eventType} event (job: ${job.id}, event: ${eventId || 'no-id'})`,
      );

      // Process the validated event
      await this.processEvent(validatedEvent);

      // Emit to EventEmitter2 for WebSocket Gateway to pick up
      this.eventEmitter.emit(eventType, validatedEvent);

      this.logger.debug(
        `Successfully processed ${eventType} event (job: ${job.id}, event: ${eventId || 'no-id'})`,
      );

      return {
        success: true,
        eventId: eventId || job.id,
      };
    } catch (error) {
      this.logger.error(
        `Error processing job ${job.id} (${eventType}):`,
        error instanceof Error ? error.message : String(error),
      );

      return {
        success: false,
        eventId: eventId || job.id,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Helper method to update job progress
   */
  protected updateProgress(job: Job, progress: number): void {
    job.updateProgress(progress).catch((err) => {
      this.logger.warn(`Failed to update progress for job ${job.id}:`, err.message);
    });
  }

  /**
   * Helper method to log job data safely
   */
  protected logJobData(job: Job, maxDataLength = 200): string {
    const dataStr = JSON.stringify(job.data);
    const truncated =
      dataStr.length > maxDataLength ? `${dataStr.slice(0, maxDataLength)}...` : dataStr;
    return truncated;
  }
}
