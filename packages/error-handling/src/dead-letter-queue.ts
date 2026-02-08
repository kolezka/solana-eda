import Redis from 'ioredis';

/**
 * Dead Letter Queue for failed events
 * Stores failed events for later processing and analysis
 */

export interface DeadLetterEvent {
  id: string;
  originalEvent: any;
  error: string;
  errorType: string;
  timestamp: string;
  retryCount: number;
  lastRetryAt?: string;
  metadata?: Record<string, unknown>;
}

export class DeadLetterQueue {
  private redis: Redis;
  private keyPrefix: string;
  private maxRetries: number;
  private retentionMs: number;

  constructor(
    redis: Redis,
    options: {
      keyPrefix?: string;
      maxRetries?: number;
      retentionDays?: number;
    } = {},
  ) {
    this.redis = redis;
    this.keyPrefix = options.keyPrefix || 'dlq';
    this.maxRetries = options.maxRetries || 3;
    this.retentionMs = (options.retentionDays || 7) * 24 * 60 * 60 * 1000;
  }

  /**
   * Add a failed event to the DLQ
   */
  async add(event: any, error: Error, metadata?: Record<string, unknown>): Promise<string> {
    const id = `dlq-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

    const dlqEvent: DeadLetterEvent = {
      id,
      originalEvent: event,
      error: error.message,
      errorType: error.name,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      metadata,
    };

    const key = `${this.keyPrefix}:${id}`;
    await this.redis.setex(key, Math.floor(this.retentionMs / 1000), JSON.stringify(dlqEvent));

    // Add to index for retrieval
    await this.redis.zadd(`${this.keyPrefix}:index`, Date.now(), id);

    console.log(`[DLQ] Added event ${id} to dead letter queue: ${error.message}`);

    return id;
  }

  /**
   * Get a specific event from the DLQ
   */
  async get(id: string): Promise<DeadLetterEvent | null> {
    const key = `${this.keyPrefix}:${id}`;
    const data = await this.redis.get(key);

    if (!data) return null;

    return JSON.parse(data) as DeadLetterEvent;
  }

  /**
   * Get all events in the DLQ
   */
  async getAll(limit: number = 100, offset: number = 0): Promise<DeadLetterEvent[]> {
    const ids = await this.redis.zrevrange(`${this.keyPrefix}:index`, offset, offset + limit - 1);

    if (ids.length === 0) return [];

    const keys = ids.map((id: string) => `${this.keyPrefix}:${id}`);
    const events = await this.redis.mget(keys);

    return events
      .filter((e: string | null): e is string => e !== null)
      .map((e: string) => JSON.parse(e) as DeadLetterEvent);
  }

  /**
   * Retry a failed event
   */
  async retry(
    id: string,
    retryFn: (event: any) => Promise<void>,
  ): Promise<{ success: boolean; error?: string }> {
    const dlqEvent = await this.get(id);

    if (!dlqEvent) {
      return { success: false, error: 'Event not found in DLQ' };
    }

    // Check retry limit
    if (dlqEvent.retryCount >= this.maxRetries) {
      return { success: false, error: 'Max retries exceeded' };
    }

    // Update retry count
    dlqEvent.retryCount++;
    dlqEvent.lastRetryAt = new Date().toISOString();

    try {
      await retryFn(dlqEvent.originalEvent);

      // Remove from DLQ on success
      await this.remove(id);

      console.log(`[DLQ] Successfully retried event ${id}`);

      return { success: true };
    } catch (error) {
      // Update event with new error
      dlqEvent.error = (error as Error).message;
      dlqEvent.errorType = (error as Error).name;

      const key = `${this.keyPrefix}:${id}`;
      await this.redis.setex(key, Math.floor(this.retentionMs / 1000), JSON.stringify(dlqEvent));

      console.error(`[DLQ] Retry failed for event ${id}:`, error);

      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Remove an event from the DLQ
   */
  async remove(id: string): Promise<void> {
    const key = `${this.keyPrefix}:${id}`;
    await this.redis.del(key);
    await this.redis.zrem(`${this.keyPrefix}:index`, id);
  }

  /**
   * Clear all events from the DLQ
   */
  async clear(): Promise<void> {
    const ids = await this.redis.zrange(`${this.keyPrefix}:index`, 0, -1);

    if (ids.length > 0) {
      const keys = ids.map((id: string) => `${this.keyPrefix}:${id}`);
      await this.redis.del(...keys, `${this.keyPrefix}:index`);
    }

    console.log(`[DLQ] Cleared ${ids.length} events from dead letter queue`);
  }

  /**
   * Clean up expired events
   */
  async cleanup(): Promise<number> {
    const cutoff = Date.now() - this.retentionMs;
    const ids = await this.redis.zrangebyscore(`${this.keyPrefix}:index`, 0, cutoff);

    if (ids.length > 0) {
      const keys = ids.map((id: string) => `${this.keyPrefix}:${id}`);
      await this.redis.del(...keys);
      await this.redis.zremrangebyscore(`${this.keyPrefix}:index`, 0, cutoff);

      console.log(`[DLQ] Cleaned up ${ids.length} expired events`);
    }

    return ids.length;
  }

  /**
   * Get DLQ statistics
   */
  async getStats(): Promise<{
    total: number;
    byErrorType: Record<string, number>;
    byRetryCount: Record<string, number>;
  }> {
    const events = await this.getAll(1000);

    const byErrorType: Record<string, number> = {};
    const byRetryCount: Record<string, number> = {};

    for (const event of events) {
      byErrorType[event.errorType] = (byErrorType[event.errorType] || 0) + 1;
      const rc = event.retryCount.toString();
      byRetryCount[rc] = (byRetryCount[rc] || 0) + 1;
    }

    return {
      total: events.length,
      byErrorType,
      byRetryCount,
    };
  }
}
