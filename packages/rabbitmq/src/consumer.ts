/**
 * RabbitMQ Message Consumer
 * Handles message consumption with manual ACK, prefetch, and error handling
 */

import type { Channel, Message } from 'amqplib';
import { type RabbitMQConnection } from './connection';
import {
  type EventEnvelope,
  type ConsumerConfig,
  type AckOptions,
  type ConsumerMetrics,
  EXCHANGES,
} from './types';

export class RabbitMQConsumer {
  private consumers: Map<string, { tag: string; config: ConsumerConfig }> = new Map();
  private metrics: ConsumerMetrics = {
    totalProcessed: 0,
    acknowledged: 0,
    nacked: 0,
    rejected: 0,
    processing: 0,
  };
  private isConsuming = false;

  constructor(
    private connection: RabbitMQConnection,
    private defaultPrefetch: number = 10
  ) {}

  /**
   * Start consuming from a queue
   */
  async consume(config: ConsumerConfig): Promise<string> {
    const channel = this.connection.getChannel();

    // Set prefetch count
    const prefetch = config.prefetch ?? this.defaultPrefetch;
    await channel.prefetch(prefetch);

    const consumeResult = await channel.consume(
      config.queueName,
      async (message: Message | null) => {
        if (!message) return;

        this.metrics.totalProcessed++;
        this.metrics.processing++;

        try {
          const envelope: EventEnvelope = JSON.parse(message.content.toString());

          // Create acknowledgment functions
          const ack = () => {
            channel.ack(message, false);
            this.metrics.acknowledged++;
            this.metrics.processing--;
          };

          const nack = (options?: AckOptions) => {
            const requeue = options?.requeue ?? true;
            channel.nack(message, false, requeue);
            if (requeue) {
              this.metrics.nacked++;
            } else {
              this.metrics.rejected++;
            }
            this.metrics.processing--;
          };

          // Call handler
          await config.handler(envelope, ack, nack);

        } catch (error) {
          console.error(`[RabbitMQ] Error processing message from ${config.queueName}:`, error);

          // NACK without requeue after max retries
          const retryCount = (message.properties.headers?.['x-retry-count'] as number) || 0;
          if (retryCount >= 3) {
            channel.nack(message, false, false); // Send to DLQ
            this.metrics.rejected++;
          } else {
            // Update retry count and requeue
            channel.nack(message, false, true);
            this.metrics.nacked++;
          }
          this.metrics.processing--;
        }
      },
      {
        consumerTag: config.consumerTag,
        noAck: !config.manualAck,
      }
    );

    const consumerTag = typeof consumeResult === 'string' ? consumeResult : consumeResult?.consumerTag;

    if (!consumerTag) {
      throw new Error(`Failed to start consumer for queue ${config.queueName}`);
    }

    this.consumers.set(consumerTag, { tag: consumerTag, config });
    this.isConsuming = true;

    console.log(`[RabbitMQ] Started consumer ${consumerTag} on queue ${config.queueName}`);

    return consumerTag;
  }

  /**
   * Stop a specific consumer
   */
  async cancel(consumerTag: string): Promise<void> {
    const consumer = this.consumers.get(consumerTag);
    if (!consumer) {
      throw new Error(`Consumer ${consumerTag} not found`);
    }

    const channel = this.connection.getChannel();
    await channel.cancel(consumerTag);

    this.consumers.delete(consumerTag);
    this.isConsuming = this.consumers.size > 0;

    console.log(`[RabbitMQ] Stopped consumer ${consumerTag}`);
  }

  /**
   * Stop all consumers
   */
  async cancelAll(): Promise<void> {
    const cancelPromises = Array.from(this.consumers.keys()).map(tag =>
      this.cancel(tag).catch(error => {
        console.error(`[RabbitMQ] Error cancelling consumer ${tag}:`, error);
      })
    );

    await Promise.all(cancelPromises);
    this.isConsuming = false;
  }

  /**
   * Check if any consumers are active
   */
  isActive(): boolean {
    return this.isConsuming;
  }

  /**
   * Get active consumer count
   */
  getConsumerCount(): number {
    return this.consumers.size;
  }

  /**
   * Get consumer metrics
   */
  getMetrics(): ConsumerMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalProcessed: 0,
      acknowledged: 0,
      nacked: 0,
      rejected: 0,
      processing: 0,
    };
  }
}
