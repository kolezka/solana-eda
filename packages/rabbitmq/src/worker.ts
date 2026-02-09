/**
 * RabbitMQ Producer for Workers
 * Simplified producer that can be used in standalone worker processes
 */

import { RabbitMQConnection } from './connection';

export interface WorkerRabbitMQConfig {
  url: string;
  exchangeName?: string;
  enablePublisherConfirms?: boolean;
  prefetchCount?: number;
  reconnectDelay?: number;
}

/**
 * Initialize RabbitMQ connection for a worker
 */
export async function initWorkerRabbitMQ(config: WorkerRabbitMQConfig) {
  const connection = new RabbitMQConnection({
    url: config.url || process.env.RABBITMQ_URL || 'amqp://solana:solana123@localhost:5672',
    exchangeName: config.exchangeName || 'solana.events',
    enablePublisherConfirms: config.enablePublisherConfirms ?? true,
    prefetchCount: config.prefetchCount ?? 10,
    reconnectDelay: config.reconnectDelay ?? 5000,
  });

  await connection.connect();
  return connection;
}

/**
 * Publish event from worker to RabbitMQ
 */
export async function publishWorkerEvent(
  connection: RabbitMQConnection,
  eventType: string,
  data: Record<string, unknown>,
  options?: {
    routingKey?: string;
    source?: string;
    correlationId?: string;
  }
): Promise<void> {
  const { RabbitMQProducer } = await import('./producer');

  const producer = new RabbitMQProducer(
    connection,
    'solana.events',
    options?.source || 'worker'
  );

  await producer.publish(eventType, data, {
    routingKey: options?.routingKey,
    correlationId: options?.correlationId,
  });
}

/**
 * Close worker RabbitMQ connection
 */
export async function closeWorkerRabbitMQ(connection: RabbitMQConnection): Promise<void> {
  await connection.close();
}
