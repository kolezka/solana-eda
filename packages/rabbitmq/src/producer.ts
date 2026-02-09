/**
 * RabbitMQ Message Producer
 * Handles message publishing with publisher confirms and event envelope creation
 */

import { v4 as uuidv4 } from 'uuid';
import type { Channel } from 'amqplib';
import { type RabbitMQConnection } from './connection';
import {
  type EventEnvelope,
  type PublishOptions,
  type PublisherMetrics,
  EXCHANGES,
} from './types';

export class RabbitMQProducer {
  private metrics: PublisherMetrics = {
    totalPublished: 0,
    confirmed: 0,
    failed: 0,
    pending: 0,
  };

  constructor(
    private connection: RabbitMQConnection,
    private defaultExchange: string = EXCHANGES.EVENTS,
    private defaultSource: string = 'unknown'
  ) {}

  /**
   * Publish an event with envelope
   */
  async publish(
    eventType: string,
    data: unknown,
    options: Partial<PublishOptions> = {}
  ): Promise<void> {
    const channel = this.connection.getChannel();

    // Ensure exchange exists
    await channel.assertExchange(this.defaultExchange, 'topic', { durable: true });

    const envelope: EventEnvelope = {
      version: '1.0',
      id: options.correlationId || uuidv4(),
      correlationId: options.correlationId || uuidv4(),
      timestamp: new Date().toISOString(),
      type: eventType,
      routingKey: options.routingKey || this.deriveRoutingKey(eventType),
      data,
      source: options.correlationId ? undefined : this.defaultSource,
      causationId: options.causationId,
    };

    const buffer = Buffer.from(JSON.stringify(envelope));

    // Update metrics
    this.metrics.totalPublished++;
    this.metrics.pending++;

    try {
      const published = channel.publish(
        this.defaultExchange,
        envelope.routingKey,
        buffer,
        {
          persistent: options.persistent ?? true,
          priority: options.priority,
          expiration: options.expiration,
          correlationId: envelope.correlationId,
          messageId: envelope.id,
          timestamp: Date.now(),
          contentType: 'application/json',
          contentEncoding: 'utf-8',
        }
      );

      if (!published) {
        // Channel buffer is full, wait for drain
        await new Promise<void>((resolve) => {
          channel.once('drain', resolve);
        });
      }

      // Wait for confirm if enabled
      if ((this.connection as any).config?.enablePublisherConfirms) {
        await (channel as any).waitForConfirms();
      }

      this.metrics.confirmed++;
      this.metrics.pending--;

    } catch (error) {
      this.metrics.failed++;
      this.metrics.pending--;
      throw error;
    }
  }

  /**
   * Publish worker status event
   */
  async publishStatus(
    workerName: string,
    status: 'STARTING' | 'RUNNING' | 'STOPPING' | 'ERROR',
    data: Record<string, unknown>
  ): Promise<void> {
    return this.publish('WORKER_STATUS', {
      workerName,
      status,
      ...data,
    }, {
      routingKey: `worker.${workerName}.${status.toLowerCase()}`,
    });
  }

  /**
   * Publish to a specific exchange (non-default)
   */
  async publishToExchange(
    exchange: string,
    routingKey: string,
    data: unknown,
    options: Partial<PublishOptions> = {}
  ): Promise<void> {
    const channel = this.connection.getChannel();

    await channel.assertExchange(exchange, 'topic', { durable: true });

    const envelope: EventEnvelope = {
      version: '1.0',
      id: uuidv4(),
      correlationId: options.correlationId || uuidv4(),
      timestamp: new Date().toISOString(),
      type: 'CUSTOM',
      routingKey,
      data,
      source: this.defaultSource,
      causationId: options.causationId,
    };

    const buffer = Buffer.from(JSON.stringify(envelope));

    this.metrics.totalPublished++;
    this.metrics.pending++;

    try {
      const published = channel.publish(exchange, routingKey, buffer, {
        persistent: options.persistent ?? true,
        priority: options.priority,
        expiration: options.expiration,
        correlationId: envelope.correlationId,
        messageId: envelope.id,
      });

      if (!published) {
        await new Promise<void>((resolve) => {
          channel.once('drain', resolve);
        });
      }

      if ((this.connection as any).config?.enablePublisherConfirms) {
        await (channel as any).waitForConfirms();
      }

      this.metrics.confirmed++;
      this.metrics.pending--;

    } catch (error) {
      this.metrics.failed++;
      this.metrics.pending--;
      throw error;
    }
  }

  /**
   * Get current publisher metrics
   */
  getMetrics(): PublisherMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalPublished: 0,
      confirmed: 0,
      failed: 0,
      pending: 0,
    };
  }

  /**
   * Derive routing key from event type
   * Converts BURN_DETECTED -> burn.detected
   */
  private deriveRoutingKey(eventType: string): string {
    return eventType
      .toLowerCase()
      .replace(/_/g, '.');
  }
}
