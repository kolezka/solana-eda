/**
 * Factory function for creating RabbitMQ clients
 * Provides convenient entry point for the package
 */

import { RabbitMQConnection } from './connection';
import { RabbitMQProducer } from './producer';
import { RabbitMQConsumer } from './consumer';
import { setupTopology, setupDLQ } from './topology';
import type { RabbitMQConfig } from './types';

export interface RabbitMQClient {
  connection: RabbitMQConnection;
  producer: RabbitMQProducer;
  consumer: RabbitMQConsumer;
}

/**
 * Create a fully configured RabbitMQ client
 *
 * @param config - RabbitMQ configuration
 * @param source - Source name for published events
 * @returns Connected RabbitMQ client with producer and consumer
 */
export async function createRabbitMQClient(
  config: RabbitMQConfig,
  source: string = 'unknown'
): Promise<RabbitMQClient> {
  // Create connection
  const connection = new RabbitMQConnection(config);
  await connection.connect();

  // Setup topology
  const channel = connection.getChannel();
  await setupTopology(channel);
  await setupDLQ(channel);

  // Create producer and consumer
  const producer = new RabbitMQProducer(
    connection,
    config.exchangeName || 'solana.events',
    source
  );

  const consumer = new RabbitMQConsumer(
    connection,
    config.prefetchCount || 10
  );

  return {
    connection,
    producer,
    consumer,
  };
}
