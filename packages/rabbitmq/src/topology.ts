/**
 * RabbitMQ Topology Setup
 * Creates exchanges, queues, and bindings for Solana EDA
 */

import type { Channel } from 'amqplib';
import { type ExchangeConfig, type QueueConfig, EXCHANGES, QUEUES, ROUTING_KEYS } from './types';

/**
 * Setup complete RabbitMQ topology for Solana EDA
 */
export async function setupTopology(channel: Channel): Promise<void> {
  // Create exchanges
  await createExchanges(channel);

  // Create queues with DLQ bindings
  await createQueues(channel);

  // Bind queues to exchanges
  await bindQueues(channel);

  console.log('[RabbitMQ] Topology setup complete');
}

/**
 * Create all required exchanges
 */
async function createExchanges(channel: Channel): Promise<void> {
  const exchanges: ExchangeConfig[] = [
    { name: EXCHANGES.EVENTS, type: 'topic', durable: true },
    { name: EXCHANGES.STATUS, type: 'fanout', durable: true },
    { name: EXCHANGES.DLQ, type: 'fanout', durable: true },
  ];

  for (const exchange of exchanges) {
    await channel.assertExchange(exchange.name, exchange.type, {
      durable: exchange.durable,
      autoDelete: exchange.autoDelete ?? false,
    });
    console.log(`[RabbitMQ] Exchange created: ${exchange.name} (${exchange.type})`);
  }
}

/**
 * Create all required queues with DLQ configuration
 */
async function createQueues(channel: Channel): Promise<void> {
  const queues: QueueConfig[] = [
    {
      name: QUEUES.BURN_EVENTS,
      routingKeys: ['burn.detected', 'burn.large'],
      durable: true,
      deadLetterExchange: EXCHANGES.DLQ,
      deadLetterRoutingKey: QUEUES.BURN_EVENTS,
    },
    {
      name: QUEUES.TRADE_EVENTS,
      routingKeys: ['trade.executed', 'trade.failed', 'trade.confirmed'],
      durable: true,
      deadLetterExchange: EXCHANGES.DLQ,
      deadLetterRoutingKey: QUEUES.TRADE_EVENTS,
    },
    {
      name: QUEUES.PRICE_EVENTS,
      routingKeys: ['price.updated', 'price.threshold'],
      durable: true,
      deadLetterExchange: EXCHANGES.DLQ,
      deadLetterRoutingKey: QUEUES.PRICE_EVENTS,
    },
    {
      name: QUEUES.LIQUIDITY_EVENTS,
      routingKeys: ['liquidity.added', 'liquidity.removed', 'liquidity.changed'],
      durable: true,
      deadLetterExchange: EXCHANGES.DLQ,
      deadLetterRoutingKey: QUEUES.LIQUIDITY_EVENTS,
    },
    {
      name: QUEUES.POSITION_EVENTS,
      routingKeys: ['position.opened', 'position.closed', 'position.updated'],
      durable: true,
      deadLetterExchange: EXCHANGES.DLQ,
      deadLetterRoutingKey: QUEUES.POSITION_EVENTS,
    },
    {
      name: QUEUES.WORKERS_STATUS,
      routingKeys: ['worker.#'],
      durable: true,
      deadLetterExchange: EXCHANGES.DLQ,
      deadLetterRoutingKey: QUEUES.WORKERS_STATUS,
    },
    {
      name: QUEUES.TOKEN_LAUNCH,
      routingKeys: ['token.launched', 'token.delist'],
      durable: true,
      deadLetterExchange: EXCHANGES.DLQ,
      deadLetterRoutingKey: QUEUES.TOKEN_LAUNCH,
    },
    {
      name: QUEUES.MARKET_EVENTS,
      routingKeys: ['market.trending', 'market.summary'],
      durable: true,
      deadLetterExchange: EXCHANGES.DLQ,
      deadLetterRoutingKey: QUEUES.MARKET_EVENTS,
    },
    {
      name: QUEUES.ARBITRAGE_EVENTS,
      routingKeys: ['arbitrage.detected', 'arbitrage.executed'],
      durable: true,
      deadLetterExchange: EXCHANGES.DLQ,
      deadLetterRoutingKey: QUEUES.ARBITRAGE_EVENTS,
    },
    {
      name: QUEUES.SYSTEM_EVENTS,
      routingKeys: ['system.#'],
      durable: true,
      deadLetterExchange: EXCHANGES.DLQ,
      deadLetterRoutingKey: QUEUES.SYSTEM_EVENTS,
    },
  ];

  for (const queue of queues) {
    const args: Record<string, unknown> = {};

    if (queue.deadLetterExchange) {
      args['x-dead-letter-exchange'] = queue.deadLetterExchange;
    }
    if (queue.deadLetterRoutingKey) {
      args['x-dead-letter-routing-key'] = queue.deadLetterRoutingKey;
    }
    if (queue.messageTtl) {
      args['x-message-ttl'] = queue.messageTtl;
    }
    if (queue.maxLength) {
      args['x-max-length'] = queue.maxLength;
    }

    await channel.assertQueue(queue.name, {
      durable: queue.durable ?? true,
      arguments: Object.keys(args).length > 0 ? args : undefined,
    });

    console.log(`[RabbitMQ] Queue created: ${queue.name}`);
  }
}

/**
 * Bind queues to exchanges with routing keys
 */
async function bindQueues(channel: Channel): Promise<void> {
  const bindings: Array<{ queue: string; exchange: string; routingKey: string }> = [
    // Burn events
    { queue: QUEUES.BURN_EVENTS, exchange: EXCHANGES.EVENTS, routingKey: 'burn.detected' },
    { queue: QUEUES.BURN_EVENTS, exchange: EXCHANGES.EVENTS, routingKey: 'burn.large' },

    // Trade events
    { queue: QUEUES.TRADE_EVENTS, exchange: EXCHANGES.EVENTS, routingKey: 'trade.executed' },
    { queue: QUEUES.TRADE_EVENTS, exchange: EXCHANGES.EVENTS, routingKey: 'trade.failed' },
    { queue: QUEUES.TRADE_EVENTS, exchange: EXCHANGES.EVENTS, routingKey: 'trade.confirmed' },

    // Price events
    { queue: QUEUES.PRICE_EVENTS, exchange: EXCHANGES.EVENTS, routingKey: 'price.updated' },
    { queue: QUEUES.PRICE_EVENTS, exchange: EXCHANGES.EVENTS, routingKey: 'price.threshold' },

    // Liquidity events
    { queue: QUEUES.LIQUIDITY_EVENTS, exchange: EXCHANGES.EVENTS, routingKey: 'liquidity.added' },
    { queue: QUEUES.LIQUIDITY_EVENTS, exchange: EXCHANGES.EVENTS, routingKey: 'liquidity.removed' },
    { queue: QUEUES.LIQUIDITY_EVENTS, exchange: EXCHANGES.EVENTS, routingKey: 'liquidity.changed' },

    // Position events
    { queue: QUEUES.POSITION_EVENTS, exchange: EXCHANGES.EVENTS, routingKey: 'position.opened' },
    { queue: QUEUES.POSITION_EVENTS, exchange: EXCHANGES.EVENTS, routingKey: 'position.closed' },
    { queue: QUEUES.POSITION_EVENTS, exchange: EXCHANGES.EVENTS, routingKey: 'position.updated' },

    // Worker status (wildcard)
    { queue: QUEUES.WORKERS_STATUS, exchange: EXCHANGES.EVENTS, routingKey: 'worker.*' },

    // Token launch events
    { queue: QUEUES.TOKEN_LAUNCH, exchange: EXCHANGES.EVENTS, routingKey: 'token.launched' },
    { queue: QUEUES.TOKEN_LAUNCH, exchange: EXCHANGES.EVENTS, routingKey: 'token.delist' },

    // Market events
    { queue: QUEUES.MARKET_EVENTS, exchange: EXCHANGES.EVENTS, routingKey: 'market.trending' },
    { queue: QUEUES.MARKET_EVENTS, exchange: EXCHANGES.EVENTS, routingKey: 'market.summary' },

    // Arbitrage events
    { queue: QUEUES.ARBITRAGE_EVENTS, exchange: EXCHANGES.EVENTS, routingKey: 'arbitrage.detected' },
    { queue: QUEUES.ARBITRAGE_EVENTS, exchange: EXCHANGES.EVENTS, routingKey: 'arbitrage.executed' },

    // System events
    { queue: QUEUES.SYSTEM_EVENTS, exchange: EXCHANGES.EVENTS, routingKey: 'system.*' },
  ];

  for (const binding of bindings) {
    await channel.bindQueue(binding.queue, binding.exchange, binding.routingKey);
    console.log(`[RabbitMQ] Bound ${binding.queue} to ${binding.exchange} with ${binding.routingKey}`);
  }
}

/**
 * Dead letter queues setup
 */
export async function setupDLQ(channel: Channel): Promise<void> {
  // DLQ queue for each main queue
  const dlqQueues = [
    `${QUEUES.BURN_EVENTS}.dlq`,
    `${QUEUES.TRADE_EVENTS}.dlq`,
    `${QUEUES.PRICE_EVENTS}.dlq`,
    `${QUEUES.LIQUIDITY_EVENTS}.dlq`,
    `${QUEUES.POSITION_EVENTS}.dlq`,
    `${QUEUES.WORKERS_STATUS}.dlq`,
    `${QUEUES.TOKEN_LAUNCH}.dlq`,
    `${QUEUES.MARKET_EVENTS}.dlq`,
    `${QUEUES.ARBITRAGE_EVENTS}.dlq`,
    `${QUEUES.SYSTEM_EVENTS}.dlq`,
  ];

  for (const dlq of dlqQueues) {
    await channel.assertQueue(dlq, { durable: true });
    await channel.bindQueue(dlq, EXCHANGES.DLQ, dlq);
    console.log(`[RabbitMQ] DLQ created: ${dlq}`);
  }
}

/**
 * Purge a queue (use with caution)
 */
export async function purgeQueue(channel: Channel, queueName: string): Promise<number> {
  const result = await channel.purgeQueue(queueName);
  const messageCount = typeof result === 'number' ? result : result?.messageCount || 0;
  console.log(`[RabbitMQ] Purged ${messageCount} messages from ${queueName}`);
  return messageCount;
}

/**
 * Delete a queue (use with caution)
 */
export async function deleteQueue(channel: Channel, queueName: string): Promise<void> {
  await channel.deleteQueue(queueName);
  console.log(`[RabbitMQ] Deleted queue: ${queueName}`);
}

/**
 * Get queue information
 */
export async function getQueueInfo(channel: Channel, queueName: string) {
  try {
    const info = await channel.checkQueue(queueName);
    return {
      queue: info.queue,
      messageCount: info.messageCount,
      consumerCount: info.consumerCount,
    };
  } catch (error) {
    console.error(`[RabbitMQ] Error getting queue info for ${queueName}:`, error);
    return null;
  }
}
