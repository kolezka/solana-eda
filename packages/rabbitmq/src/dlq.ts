/**
 * RabbitMQ Dead Letter Queue Handler
 * Processes failed messages from DLQ with retry analysis
 */

import type { Channel } from 'amqplib';
import { type EventEnvelope } from './types';
import { EXCHANGES } from './types';

export interface DLQMessage {
  envelope: EventEnvelope;
  originalQueue: string;
  retryCount: number;
  firstFailedAt: string;
  lastFailedAt: string;
  errorReason?: string;
}

export interface DLQHandlerOptions {
  maxRetryAttempts?: number;
  retryDelay?: number; // milliseconds
  onMaxRetriesExceeded?: (message: DLQMessage) => void | Promise<void>;
}

/**
 * Process messages from a specific DLQ
 */
export class DLQHandler {
  private processing = false;

  constructor(
    private channel: Channel,
    private dlqName: string,
    private options: DLQHandlerOptions = {}
  ) {}

  /**
   * Start processing DLQ messages
   */
  async start(): Promise<void> {
    if (this.processing) {
      console.warn(`[DLQ] Already processing ${this.dlqName}`);
      return;
    }

    this.processing = true;

    await this.channel.consume(
      this.dlqName,
      async (msg) => {
        if (!msg) return;

        try {
          const envelope: EventEnvelope = JSON.parse(msg.content.toString());
          const headers = msg.properties.headers || {};

          const dlqMessage: DLQMessage = {
            envelope,
            originalQueue: headers['x-death']?.[0]?.['queue'] || 'unknown',
            retryCount: headers['x-retry-count'] || 0,
            firstFailedAt: headers['x-first-failure-at'] || new Date().toISOString(),
            lastFailedAt: new Date().toISOString(),
            errorReason: headers['x-error-reason'] as string,
          };

          await this.handleDLQMessage(dlqMessage, msg);

        } catch (error) {
          console.error(`[DLQ] Error processing message from ${this.dlqName}:`, error);
          // ACK to remove from DLQ (corrupted message)
          this.channel.ack(msg);
        }
      },
      { noAck: false }
    );

    console.log(`[DLQ] Started processing ${this.dlqName}`);
  }

  /**
   * Stop processing DLQ messages
   */
  async stop(): Promise<void> {
    this.processing = false;
    console.log(`[DLQ] Stopped processing ${this.dlqName}`);
  }

  /**
   * Handle a DLQ message
   */
  private async handleDLQMessage(message: DLQMessage, originalMessage: any): Promise<void> {
    const maxRetries = this.options.maxRetryAttempts ?? 3;

    console.log(`[DLQ] Processing failed message from ${message.originalQueue}:`, {
      eventType: message.envelope.type,
      retryCount: message.retryCount,
      errorReason: message.errorReason,
    });

    // Analyze failure reason
    const shouldRetry = await this.analyzeFailure(message);

    if (shouldRetry && message.retryCount < maxRetries) {
      await this.retryMessage(message);
    } else {
      await this.handlePermanentFailure(message);
    }

    // ACK to remove from DLQ
    this.channel.ack(originalMessage);
  }

  /**
   * Analyze failure to determine if retry is appropriate
   */
  private async analyzeFailure(message: DLQMessage): Promise<boolean> {
    const { errorReason, envelope } = message;

    // Don't retry validation errors
    if (errorReason?.includes('validation')) {
      return false;
    }

    // Don't retry permanently failed transactions
    if (envelope.type === 'TRANSACTION_FAILED') {
      return false;
    }

    // Retry transient errors
    const transientErrors = ['timeout', 'network', 'rate limit', 'temporary'];
    return transientErrors.some(err => errorReason?.toLowerCase().includes(err));
  }

  /**
   * Retry message by republishing to original queue
   */
  private async retryMessage(message: DLQMessage): Promise<void> {
    const { envelope, originalQueue } = message;

    // Increment retry count
    const headers = {
      'x-retry-count': message.retryCount + 1,
      'x-first-failure-at': message.firstFailedAt,
    };

    // Republish to original exchange/queue
    const retryBuffer = Buffer.from(JSON.stringify(envelope));

    // Extract original routing key from envelope
    const routingKey = envelope.routingKey;

    await this.channel.publish(EXCHANGES.EVENTS, routingKey, retryBuffer, {
      headers,
      persistent: true,
      contentType: 'application/json',
    });

    console.log(`[DLQ] Retrying message ${envelope.id} to ${originalQueue} (attempt ${message.retryCount + 1})`);
  }

  /**
   * Handle permanent failure (log, alert, store)
   */
  private async handlePermanentFailure(message: DLQMessage): Promise<void> {
    console.error(`[DLQ] Permanent failure for message ${message.envelope.id}:`, {
      type: message.envelope.type,
      originalQueue: message.originalQueue,
      retryCount: message.retryCount,
      errorReason: message.errorReason,
    });

    // Call custom handler if provided
    if (this.options.onMaxRetriesExceeded) {
      await this.options.onMaxRetriesExceeded(message);
    }

    // TODO: Store in database for manual review
    // TODO: Send alert (email, Slack, etc.)
  }

  /**
   * Get DLQ statistics
   */
  async getStats(): Promise<{
    queueName: string;
    messageCount: number;
  }> {
    try {
      const info = await this.channel.checkQueue(this.dlqName);
      return {
        queueName: this.dlqName,
        messageCount: info.messageCount,
      };
    } catch (error) {
      console.error(`[DLQ] Error getting stats for ${this.dlqName}:`, error);
      return {
        queueName: this.dlqName,
        messageCount: -1,
      };
    }
  }

  /**
   * Purge all messages from DLQ (use with caution)
   */
  async purge(): Promise<number> {
    const result = await this.channel.purgeQueue(this.dlqName);
    const messageCount = typeof result === 'number' ? result : result?.messageCount || 0;
    console.log(`[DLQ] Purged ${messageCount} messages from ${this.dlqName}`);
    return messageCount;
  }

  /**
   * Replay a specific message to original queue
   */
  async replay(message: DLQMessage): Promise<void> {
    await this.retryMessage(message);
  }
}

/**
 * Create DLQ handler for a specific queue
 */
export function createDLQHandler(
  channel: Channel,
  queueName: string,
  options?: DLQHandlerOptions
): DLQHandler {
  const dlqName = `${queueName}.dlq`;
  return new DLQHandler(channel, dlqName, options);
}

/**
 * Setup all DLQ handlers for Solana EDA
 */
export async function setupAllDLQHandlers(
  channel: Channel,
  options?: DLQHandlerOptions
): Promise<DLQHandler[]> {
  const queues = [
    'q.burn.events',
    'q.trade.events',
    'q.price.events',
    'q.liquidity.events',
    'q.positions',
    'q.workers',
    'q.token.launch',
    'q.market.events',
    'q.arbitrage',
    'q.system',
  ];

  const handlers: DLQHandler[] = [];

  for (const queue of queues) {
    const handler = createDLQHandler(channel, queue, options);
    handlers.push(handler);
    await handler.start();
  }

  console.log(`[DLQ] Setup ${handlers.length} DLQ handlers`);
  return handlers;
}
