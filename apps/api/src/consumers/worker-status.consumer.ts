import { Injectable } from '@nestjs/common';
import { BaseEventConsumer } from './base/base-event.consumer';
import { QUEUES, type EventEnvelope } from '@solana-eda/rabbitmq';
import type { AnyEvent } from '@solana-eda/events';
import { isWorkerStatusEvent } from '@solana-eda/events';

/**
 * Consumer for WORKER_STATUS events
 * Tracks worker health and metrics
 */
@Injectable()
export class WorkerStatusConsumer extends BaseEventConsumer {
  protected async processEvent(event: AnyEvent, envelope: EventEnvelope): Promise<void> {
    if (!isWorkerStatusEvent(event)) {
      throw new Error(`Invalid event type for WorkerStatusConsumer: ${event.type}`);
    }

    const startTime = Date.now();

    await this.persistWithRetry(async () => {
      await this.prisma.workerStatusRecord.upsert({
        where: { name: event.data.workerName },
        update: {
          status: event.data.status,
          lastSeen: new Date(event.timestamp),
          metrics: {
            eventsProcessed: event.data.metrics.eventsProcessed,
            errors: event.data.metrics.errors,
            uptime: event.data.metrics.uptime,
          },
        },
        create: {
          name: event.data.workerName,
          status: event.data.status,
          lastSeen: new Date(event.timestamp),
          metrics: {
            eventsProcessed: event.data.metrics.eventsProcessed,
            errors: event.data.metrics.errors,
            uptime: event.data.metrics.uptime,
          },
        },
      });

      this.logger.debug(`Worker status updated: ${event.data.workerName} - ${event.data.status}`);
    });

    this.logProcessingMetrics(event.type, Date.now() - startTime);
  }

  protected getQueueName(): string {
    return QUEUES.WORKERS_STATUS;
  }
}
