/**
 * BullMQ Consumers Module
 * Registers and manages all BullMQ consumers (workers)
 */

import { Module, Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import {
  BULLMQ_WORKER_MANAGER,
} from '../bullmq.module';
import { BullMQWorkerManager } from '../bullmq.module';
import { BULLMQ_QUEUES, type BullMQQueueName } from '@solana-eda/queue-bullmq';
import { FeatureFlags } from '@solana-eda/events';
import {
  BurnEventConsumer,
  LiquidityEventConsumer,
  PriceEventConsumer,
  TradeEventConsumer,
  PositionEventConsumer,
  WorkerStatusConsumer,
} from './index';

/**
 * Consumer registration configuration
 */
interface ConsumerConfig {
  eventType: string | string[];
  queueName: BullMQQueueName;
  consumer: any;
  concurrency?: number;
}

/**
 * Consumer Registry
 * Registers all consumers with the BullMQ WorkerManager
 */
@Injectable()
export class BullMQConsumerRegistry implements OnModuleInit, OnModuleDestroy {
  private readonly registeredQueues: Set<BullMQQueueName> = new Set();

  constructor(
    @Inject(BULLMQ_WORKER_MANAGER) private readonly workerManager: BullMQWorkerManager,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly burnConsumer: BurnEventConsumer,
    private readonly liquidityConsumer: LiquidityEventConsumer,
    private readonly priceConsumer: PriceEventConsumer,
    private readonly tradeConsumer: TradeEventConsumer,
    private readonly positionConsumer: PositionEventConsumer,
    private readonly workerStatusConsumer: WorkerStatusConsumer,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!FeatureFlags.isBullMQEnabled()) {
      console.log('[BullMQ Consumers] Disabled by feature flag');
      return;
    }

    console.log('[BullMQ Consumers] Registering consumers...');

    // Define all consumer configurations
    const consumerConfigs: ConsumerConfig[] = [
      { eventType: 'BURN_DETECTED', queueName: BULLMQ_QUEUES.BURN_EVENTS, consumer: this.burnConsumer },
      { eventType: 'LIQUIDITY_CHANGED', queueName: BULLMQ_QUEUES.LIQUIDITY_EVENTS, consumer: this.liquidityConsumer },
      { eventType: 'PRICE_UPDATE', queueName: BULLMQ_QUEUES.PRICE_EVENTS, consumer: this.priceConsumer },
      { eventType: 'TRADE_EXECUTED', queueName: BULLMQ_QUEUES.TRADE_EVENTS, consumer: this.tradeConsumer },
      { eventType: ['POSITION_OPENED', 'POSITION_CLOSED'], queueName: BULLMQ_QUEUES.POSITION_EVENTS, consumer: this.positionConsumer },
      { eventType: 'WORKER_STATUS', queueName: BULLMQ_QUEUES.WORKER_STATUS, consumer: this.workerStatusConsumer },
    ];

    // Register each consumer with its corresponding queue
    for (const config of consumerConfigs) {
      this.registerConsumer(config);
    }

    console.log(`[BullMQ Consumers] Registered ${this.registeredQueues.size} queue workers`);
  }

  /**
   * Register a consumer with the BullMQ WorkerManager
   */
  private registerConsumer(config: ConsumerConfig): void {
    const { eventType, queueName, consumer, concurrency = 5 } = config;

    // Skip if already registered for this queue
    if (this.registeredQueues.has(queueName)) {
      console.log(`[BullMQ Consumers] Worker already registered for queue ${queueName}, skipping...`);
      return;
    }

    try {
      const eventTypes = Array.isArray(eventType) ? eventType : [eventType];

      this.workerManager.registerWorker(
        queueName,
        async (job) => {
          const result = await consumer.process(job);
          if (!result.success) {
            throw new Error(result.error || 'Unknown error');
          }
        },
        { concurrency },
      );

      this.registeredQueues.add(queueName);
      console.log(`[BullMQ Consumers] Registered worker for queue ${queueName} (events: ${eventTypes.join(', ')})`);
    } catch (error) {
      console.error(`[BullMQ Consumers] Failed to register worker for queue ${queueName}:`, error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    console.log('[BullMQ Consumers] Cleaning up consumers...');
    this.registeredQueues.clear();
  }

  /**
   * Get registered queue count
   */
  getWorkersCount(): number {
    return this.registeredQueues.size;
  }

  /**
   * Check if a queue has a registered worker
   */
  isQueueRegistered(queueName: BullMQQueueName): boolean {
    return this.registeredQueues.has(queueName);
  }
}

/**
 * BullMQ Consumers Module
 * Provides all consumers and registers them with the worker manager
 */
@Module({
  imports: [],
  providers: [
    BullMQConsumerRegistry,
    BurnEventConsumer,
    LiquidityEventConsumer,
    PriceEventConsumer,
    TradeEventConsumer,
    PositionEventConsumer,
    WorkerStatusConsumer,
  ],
  exports: [
    BullMQConsumerRegistry,
    BurnEventConsumer,
    LiquidityEventConsumer,
    PriceEventConsumer,
    TradeEventConsumer,
    PositionEventConsumer,
    WorkerStatusConsumer,
  ],
})
export class BullMQConsumersModule {}
