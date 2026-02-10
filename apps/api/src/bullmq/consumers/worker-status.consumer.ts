/**
 * Worker Status Event Consumer for BullMQ
 * Processes WORKER_STATUS events
 */

import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BaseEventConsumer } from './base-event.consumer';
import { WorkerStatusEventSchema, type AnyEvent } from '@solana-eda/events';

/**
 * Consumer for worker status events
 * Handles validation and processing of worker health updates
 */
@Injectable()
export class WorkerStatusConsumer extends BaseEventConsumer {
  private workerStatus: Map<string, { status: string; lastUpdate: string; metrics: unknown }> =
    new Map();

  constructor(eventEmitter: EventEmitter2) {
    super(eventEmitter, WorkerStatusConsumer.name);
  }

  getEventType(): string {
    return 'WORKER_STATUS';
  }

  /**
   * Process a validated worker status event
   * Tracks worker health and metrics
   */
  async processEvent(event: AnyEvent): Promise<void> {
    // Validate using the specific schema
    const statusEvent = WorkerStatusEventSchema.parse(event);

    const { workerName, status, metrics } = statusEvent.data;

    this.logger.debug(
      `Worker status: ${workerName} is ${status} ` +
        `(events: ${metrics.eventsProcessed}, errors: ${metrics.errors}, uptime: ${metrics.uptime}s)`,
    );

    // Update internal worker status tracking
    this.workerStatus.set(workerName, {
      status,
      lastUpdate: statusEvent.timestamp,
      metrics,
    });

    // Log errors for unhealthy workers
    if (status === 'ERROR') {
      this.logger.error(`Worker ${workerName} is in ERROR state`);
    }

    // TODO: Persist worker status to database
    // TODO: Track worker health over time
    // TODO: Send alerts for workers that are down or in error state
    // TODO: Calculate uptime statistics

    // The event is automatically emitted to EventEmitter2 by the base class
    // for WebSocket Gateway to broadcast to clients
  }

  /**
   * Get current status of all workers
   */
  getAllWorkerStatus(): Map<string, { status: string; lastUpdate: string; metrics: unknown }> {
    return new Map(this.workerStatus);
  }

  /**
   * Get status of a specific worker
   */
  getWorkerStatus(workerName: string): { status: string; lastUpdate: string; metrics: unknown } | undefined {
    return this.workerStatus.get(workerName);
  }

  /**
   * Get list of workers in ERROR state
   */
  getErroredWorkers(): string[] {
    const errored: string[] = [];
    for (const [name, data] of this.workerStatus.entries()) {
      if (data.status === 'ERROR') {
        errored.push(name);
      }
    }
    return errored;
  }

  /**
   * Clean up stale worker status entries
   */
  cleanupStaleEntries(maxAgeMs = 5 * 60 * 1000): void {
    const now = Date.now();
    for (const [name, data] of this.workerStatus.entries()) {
      const lastUpdate = new Date(data.lastUpdate).getTime();
      if (now - lastUpdate > maxAgeMs) {
        this.logger.debug(`Cleaning up stale status for worker: ${name}`);
        this.workerStatus.delete(name);
      }
    }
  }
}
