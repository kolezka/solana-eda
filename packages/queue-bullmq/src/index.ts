/**
 * @solana-eda/queue-bullmq
 *
 * BullMQ integration package for Solana Event-Driven Architecture
 *
 * Provides:
 * - Queue management for event processing
 * - Worker producer for publishing jobs
 * - Consumer for processing jobs
 * - Job retry policies
 * - Dead letter queue handling
 * - Metrics and monitoring
 */

// Core classes
export { BullMQProducer } from './producer';

// Types
export {
  BULLMQ_QUEUES,
  type BullMQQueueName,
  type SolanaEventType,
  type SolanaJobData,
  type BullMQProducerConfig,
  type BullMQProducerMetrics,
  type BullMQWorkerConfig,
  type JobHandler,
  QUEUE_BY_EVENT_TYPE,
} from './types';

// Worker utilities
export {
  initWorkerBullMQ,
  publishWorkerEvent,
  getWorkerBullMQ,
  closeWorkerBullMQ,
  type WorkerBullMQConfig,
} from './worker';
