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

import type { JobsOptions } from 'bullmq';

/**
 * BullMQ queue names for Solana EDA events
 */
export const BULLMQ_QUEUES = {
  BURN_EVENTS: 'solana:burn-events',
  LIQUIDITY_EVENTS: 'solana:liquidity-events',
  TRADE_EVENTS: 'solana:trade-events',
  POSITION_EVENTS: 'solana:position-events',
  PRICE_EVENTS: 'solana:price-events',
  MARKET_EVENTS: 'solana:market-events',
  TOKEN_EVENTS: 'solana:token-events',
  POOL_EVENTS: 'solana:pool-events',
  WORKER_STATUS: 'solana:worker-status',
  DEX_COMPARISON: 'solana:dex-comparison',
} as const;

export type BullMQQueueName = typeof BULLMQ_QUEUES[keyof typeof BULLMQ_QUEUES];

/**
 * Solana EDA Event Types
 */
export type SolanaEventType =
  | 'BURN_DETECTED'
  | 'LIQUIDITY_CHANGED'
  | 'TRADE_EXECUTED'
  | 'POSITION_OPENED'
  | 'POSITION_CLOSED'
  | 'PRICE_UPDATE'
  | 'MARKET_DISCOVERED'
  | 'TOKEN_VALIDATED'
  | 'POOL_DISCOVERED'
  | 'WORKER_STATUS'
  | 'DEX_QUOTE_COMPARISON';

/**
 * BullMQ Job Data wrapper for Solana events
 */
export interface SolanaJobData {
  eventType: SolanaEventType;
  eventId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * BullMQ Producer Configuration
 */
export interface BullMQProducerConfig {
  connection: {
    host: string;
    port: number;
    username?: string;
    password?: string;
    db?: number;
  };
  defaultJobOptions?: JobsOptions;
}

/**
 * BullMQ Producer Metrics
 */
export interface BullMQProducerMetrics {
  jobsAdded: number;
  jobsFailed: number;
  jobsCompleted: number;
  lastJobAt?: string;
}

/**
 * BullMQ Worker Configuration
 */
export interface BullMQWorkerConfig {
  connection: {
    host: string;
    port: number;
    username?: string;
    password?: string;
    db?: number;
  };
  concurrency: number;
  maxJobsPerChild?: number;
}

/**
 * Job Handler Function Type
 */
export type JobHandler<T = unknown> = (data: T, job: { id: string; name: string }) => Promise<void>;

/**
 * Queue Names by Event Type
 */
export const QUEUE_BY_EVENT_TYPE: Record<SolanaEventType, BullMQQueueName> = {
  BURN_DETECTED: BULLMQ_QUEUES.BURN_EVENTS,
  LIQUIDITY_CHANGED: BULLMQ_QUEUES.LIQUIDITY_EVENTS,
  TRADE_EXECUTED: BULLMQ_QUEUES.TRADE_EVENTS,
  POSITION_OPENED: BULLMQ_QUEUES.POSITION_EVENTS,
  POSITION_CLOSED: BULLMQ_QUEUES.POSITION_EVENTS,
  PRICE_UPDATE: BULLMQ_QUEUES.PRICE_EVENTS,
  MARKET_DISCOVERED: BULLMQ_QUEUES.MARKET_EVENTS,
  TOKEN_VALIDATED: BULLMQ_QUEUES.TOKEN_EVENTS,
  POOL_DISCOVERED: BULLMQ_QUEUES.POOL_EVENTS,
  WORKER_STATUS: BULLMQ_QUEUES.WORKER_STATUS,
  DEX_QUOTE_COMPARISON: BULLMQ_QUEUES.DEX_COMPARISON,
};
