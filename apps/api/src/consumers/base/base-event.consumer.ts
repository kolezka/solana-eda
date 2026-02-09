import { Injectable, Logger, Inject } from '@nestjs/common';
import type { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RabbitMQConsumer } from '@solana-eda/rabbitmq';
import type { EventEnvelope } from '@solana-eda/rabbitmq';
import { validateEvent, type AnyEvent } from '@solana-eda/events';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Base class for all RabbitMQ event consumers
 * Handles common functionality: consuming, validating, persisting, and rebroadcasting
 */
@Injectable()
export abstract class BaseEventConsumer implements OnModuleInit, OnModuleDestroy {
  protected readonly logger = new Logger(this.constructor.name);
  protected consumerTag: string | null = null;

  constructor(
    @Inject('RabbitMQConsumer') protected readonly rabbitMQConsumer: RabbitMQConsumer,
    protected readonly eventEmitter: EventEmitter2,
    protected readonly prisma: PrismaService,
  ) {}

  /**
   * Initialize the consumer
   */
  async onModuleInit(): Promise<void> {
    try {
      this.consumerTag = await this.rabbitMQConsumer.consume({
        queueName: this.getQueueName(),
        handler: this.handleMessage.bind(this),
        manualAck: true,
      });

      this.logger.log(`Started consuming from queue: ${this.getQueueName()}`);
    } catch (error) {
      this.logger.error(`Failed to start consumer: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Clean up on module destroy
   */
  async onModuleDestroy(): Promise<void> {
    if (this.consumerTag) {
      try {
        await this.rabbitMQConsumer.cancel(this.consumerTag);
        this.logger.log(`Stopped consumer: ${this.consumerTag}`);
      } catch (error) {
        this.logger.error(`Error stopping consumer: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Handle incoming message from RabbitMQ
   */
  protected async handleMessage(
    envelope: EventEnvelope,
    ack: () => void,
    nack: (options?: { requeue: boolean }) => void
  ): Promise<void> {
    try {
      // Validate and extract the event
      const event = this.validateEvent(envelope);

      // Process the event (persist to DB)
      await this.processEvent(event, envelope);

      // Emit to EventEmitter2 for real-time delivery
      this.eventEmitter.emit(event.type, event);

      // Acknowledge successful processing
      ack();

      this.logger.debug(`Processed event ${event.id} of type ${event.type}`);
    } catch (error) {
      this.logger.error(
        `Error processing message: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined
      );

      // Negative ACK without requeue (send to DLQ)
      nack({ requeue: false });
    }
  }

  /**
   * Validate event envelope and extract event data
   */
  protected validateEvent(envelope: EventEnvelope): AnyEvent {
    // Check version compatibility
    if (envelope.version !== '1.0') {
      throw new Error(`Unsupported event version: ${envelope.version}`);
    }

    // Use Zod schema validation from events package
    // The envelope.data contains the actual event
    const eventData = {
      type: envelope.type,
      timestamp: envelope.timestamp,
      id: envelope.id,
      data: envelope.data as Record<string, unknown>,
    };

    return validateEvent(eventData);
  }

  /**
   * Process event - persist to database
   * Override in subclass for specific persistence logic
   */
  protected abstract processEvent(event: AnyEvent, envelope: EventEnvelope): Promise<void>;

  /**
   * Get the queue name for this consumer
   */
  protected abstract getQueueName(): string;

  /**
   * Helper method to log event processing metrics
   */
  protected logProcessingMetrics(eventType: string, duration: number): void {
    this.logger.debug(`Processed ${eventType} in ${duration}ms`);
  }

  /**
   * Helper method to handle database errors with retry
   */
  protected async persistWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 100; // Exponential backoff
          this.logger.warn(`Database operation failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }
}
