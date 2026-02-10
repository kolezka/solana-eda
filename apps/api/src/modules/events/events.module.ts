import { Module, Injectable, OnModuleInit, OnModuleDestroy, Inject, Logger } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsSseController } from './events-sse.controller';
import { EventsService } from './events.service';
import { EventsGateway } from './events.gateway';
import { BullMQModule, BULLMQ_WORKER_MANAGER, BULLMQ_CONNECTION } from '../../bullmq/bullmq.module';
import { BULLMQ_QUEUES, type BullMQQueueName } from '@solana-eda/queue-bullmq';
import { isBullMQEnabled } from '@solana-eda/events';
import { Worker, Job } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { AnyEvent } from '@solana-eda/events';

/**
 * BullMQ Event Workers Service
 * Manages BullMQ workers that process event jobs and forward to WebSocket via EventEmitter2
 */
@Injectable()
export class BullMQEventWorkers implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BullMQEventWorkers.name);
  private workers: Map<string, Worker> = new Map();

  constructor(
    @Inject(BULLMQ_WORKER_MANAGER) private readonly workerManager: any,
    @Inject(BULLMQ_CONNECTION) private readonly connectionProvider: any,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!isBullMQEnabled()) {
      this.logger.log('BullMQ workers disabled by feature flag');
      return;
    }

    this.logger.log('Initializing BullMQ event workers...');

    // Get Redis connection
    const connection = this.connectionProvider.getConnection();

    // Register workers for each event queue
    this.registerWorker(BULLMQ_QUEUES.BURN_EVENTS, connection, this.processBurnEvent.bind(this));
    this.registerWorker(BULLMQ_QUEUES.LIQUIDITY_EVENTS, connection, this.processLiquidityEvent.bind(this));
    this.registerWorker(BULLMQ_QUEUES.TRADE_EVENTS, connection, this.processTradeEvent.bind(this));
    this.registerWorker(BULLMQ_QUEUES.POSITION_EVENTS, connection, this.processPositionEvent.bind(this));
    this.registerWorker(BULLMQ_QUEUES.PRICE_EVENTS, connection, this.processPriceEvent.bind(this));
    this.registerWorker(BULLMQ_QUEUES.WORKER_STATUS, connection, this.processWorkerStatusEvent.bind(this));
    this.registerWorker(BULLMQ_QUEUES.MARKET_EVENTS, connection, this.processMarketEvent.bind(this));
    this.registerWorker(BULLMQ_QUEUES.TOKEN_EVENTS, connection, this.processTokenEvent.bind(this));
    this.registerWorker(BULLMQ_QUEUES.POOL_EVENTS, connection, this.processPoolEvent.bind(this));
    this.registerWorker(BULLMQ_QUEUES.DEX_COMPARISON, connection, this.processDexComparisonEvent.bind(this));

    this.logger.log(`Registered ${this.workers.size} BullMQ event workers`);
  }

  /**
   * Register a worker for a specific queue
   */
  private registerWorker(
    queueName: BullMQQueueName,
    connection: any,
    processor: (job: Job) => Promise<void>,
  ): void {
    const worker = new Worker(
      queueName,
      async (job: Job) => {
        try {
          await processor(job);
        } catch (error) {
          this.logger.error(`Error processing job ${job.id} in queue ${queueName}:`, error);
          throw error;
        }
      },
      {
        connection,
        concurrency: 5,
      },
    );

    worker.on('completed', (job) => {
      this.logger.debug(`Job ${job.id} completed in queue ${queueName}`);
    });

    worker.on('failed', (job, error) => {
      this.logger.error(`Job ${job?.id} failed in queue ${queueName}:`, error.message);
    });

    this.workers.set(queueName, worker);
    this.logger.log(`Worker registered for queue: ${queueName}`);
  }

  /**
   * Process burn event job
   */
  private async processBurnEvent(job: Job): Promise<void> {
    const event = job.data as AnyEvent;
    this.eventEmitter.emit('BURN_DETECTED', event);
  }

  /**
   * Process liquidity event job
   */
  private async processLiquidityEvent(job: Job): Promise<void> {
    const event = job.data as AnyEvent;
    this.eventEmitter.emit('LIQUIDITY_CHANGED', event);
  }

  /**
   * Process trade event job
   */
  private async processTradeEvent(job: Job): Promise<void> {
    const event = job.data as AnyEvent;
    this.eventEmitter.emit('TRADE_EXECUTED', event);
  }

  /**
   * Process position event job (opened or closed)
   */
  private async processPositionEvent(job: Job): Promise<void> {
    const event = job.data as AnyEvent;
    if (event.type === 'POSITION_OPENED') {
      this.eventEmitter.emit('POSITION_OPENED', event);
    } else if (event.type === 'POSITION_CLOSED') {
      this.eventEmitter.emit('POSITION_CLOSED', event);
    }
  }

  /**
   * Process price update event job
   */
  private async processPriceEvent(job: Job): Promise<void> {
    const event = job.data as AnyEvent;
    this.eventEmitter.emit('PRICE_UPDATE', event);
  }

  /**
   * Process worker status event job
   */
  private async processWorkerStatusEvent(job: Job): Promise<void> {
    const event = job.data as AnyEvent;
    this.eventEmitter.emit('WORKER_STATUS', event);
  }

  /**
   * Process market discovered event job
   */
  private async processMarketEvent(job: Job): Promise<void> {
    const event = job.data as AnyEvent;
    this.eventEmitter.emit('MARKET_DISCOVERED', event);
  }

  /**
   * Process token validated event job
   */
  private async processTokenEvent(job: Job): Promise<void> {
    const event = job.data as AnyEvent;
    this.eventEmitter.emit('TOKEN_VALIDATED', event);
  }

  /**
   * Process pool discovered event job
   */
  private async processPoolEvent(job: Job): Promise<void> {
    const event = job.data as AnyEvent;
    this.eventEmitter.emit('POOL_DISCOVERED', event);
  }

  /**
   * Process DEX quote comparison event job
   */
  private async processDexComparisonEvent(job: Job): Promise<void> {
    const event = job.data as AnyEvent;
    this.eventEmitter.emit('DEX_QUOTE_COMPARISON', event);
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log('Closing BullMQ event workers...');

    for (const [queueName, worker] of this.workers.entries()) {
      try {
        await worker.close();
        this.logger.log(`Worker closed for queue ${queueName}`);
      } catch (error) {
        this.logger.error(`Error closing worker for ${queueName}:`, error);
      }
    }

    this.workers.clear();
  }
}

@Module({
  imports: [BullMQModule],
  controllers: [EventsController, EventsSseController],
  providers: [EventsService, EventsGateway, BullMQEventWorkers],
  exports: [EventsService],
})
export class EventsModule {}
