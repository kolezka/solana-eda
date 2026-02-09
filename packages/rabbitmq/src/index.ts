/**
 * @solana-eda/rabbitmq
 *
 * RabbitMQ integration package for Solana Event-Driven Architecture
 *
 * Provides:
 * - Connection management with auto-reconnect
 * - Message publishing with confirms
 * - Message consumption with manual ACK
 * - Topology setup (exchanges, queues, bindings)
 * - Dead letter queue handling
 * - Retry policies
 *
 * @see docs/PHASE1_RABBITMQ_RPC_PLAN.md
 */

// Core classes
export { RabbitMQConnection } from './connection';
export { RabbitMQProducer } from './producer';
export { RabbitMQConsumer } from './consumer';

// Topology
export {
  setupTopology,
  setupDLQ,
  purgeQueue,
  deleteQueue,
  getQueueInfo,
} from './topology';

// Dead Letter Queue
export {
  DLQHandler,
  createDLQHandler,
  setupAllDLQHandlers,
  type DLQMessage,
  type DLQHandlerOptions,
} from './dlq';

// Retry policies
export {
  withRetry,
  withRetryConditional,
  calculateRetryDelay,
  generateRetryAttempts,
  RetryPolicies,
  ErrorCheckers,
  getRetryPolicyForError,
  type RetryPolicy,
  type RetryAttempt,
} from './retry';

// Types
export {
  type RabbitMQConfig,
  type EventEnvelope,
  type QueueConfig,
  type ExchangeConfig,
  type PublishOptions,
  type AckOptions,
  type MessageHandler,
  type ConsumerConfig,
  type ConnectionHealth,
  type PublisherMetrics,
  type ConsumerMetrics,
  EXCHANGES,
  QUEUES,
  ROUTING_KEYS,
} from './types';

// Convenience factory function
export { createRabbitMQClient } from './factory';

// Worker utilities
export {
  initWorkerRabbitMQ,
  publishWorkerEvent,
  closeWorkerRabbitMQ,
  type WorkerRabbitMQConfig,
} from './worker';
