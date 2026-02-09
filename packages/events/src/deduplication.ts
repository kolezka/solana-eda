/**
 * Event deduplication utilities
 * Prevents duplicate event processing across workers
 */

import { createClient } from './index';
import type { Redis } from 'ioredis';
import type { AnyEvent } from '@solana-eda/types';

/**
 * Deduplication strategy
 */
export enum DeduplicationStrategy {
  /** Deduplicate by event ID */
  ID = 'id',
  /** Deduplicate by event signature (for transactions) */
  SIGNATURE = 'signature',
  /** Deduplicate by event type and key fields */
  KEY = 'key',
  /** Custom deduplication key */
  CUSTOM = 'custom',
}

/**
 * Deduplication options
 */
export interface DeduplicationOptions {
  /** Redis client instance */
  redis: Redis;
  /** Deduplication window in milliseconds (default: 5 minutes) */
  windowMs?: number;
  /** Strategy to use for deduplication */
  strategy?: DeduplicationStrategy;
  /** Prefix for Redis keys */
  keyPrefix?: string;
  /** Custom key generator function */
  customKeyFn?: (event: AnyEvent) => string;
}

/**
 * Deduplication result
 */
export interface DeduplicationResult {
  isDuplicate: boolean;
  existingEvent?: AnyEvent;
  timeSinceFirstSeen?: number;
}

/**
 * Event deduplicator class
 */
export class EventDeduplicator {
  private redis: Redis;
  private windowMs: number;
  private strategy: DeduplicationStrategy;
  private keyPrefix: string;
  private customKeyFn?: (event: AnyEvent) => string;

  constructor(options: DeduplicationOptions) {
    this.redis = options.redis;
    this.windowMs = options.windowMs || 5 * 60 * 1000; // 5 minutes default
    this.strategy = options.strategy || DeduplicationStrategy.ID;
    this.keyPrefix = options.keyPrefix || 'event:dedup:';
    this.customKeyFn = options.customKeyFn;
  }

  /**
   * Check if an event is a duplicate
   */
  async check(event: AnyEvent): Promise<DeduplicationResult> {
    const key = this.generateKey(event);

    try {
      // Try to get existing event
      const existing = await this.redis.get(key);

      if (existing) {
        const parsed = JSON.parse(existing) as AnyEvent;
        const firstSeen = new Date(parsed.timestamp).getTime();
        const timeSinceFirstSeen = Date.now() - firstSeen;

        return {
          isDuplicate: true,
          existingEvent: parsed,
          timeSinceFirstSeen,
        };
      }

      // Not a duplicate - store it
      await this.store(event, key);

      return {
        isDuplicate: false,
      };
    } catch (error) {
      console.error(`[EventDeduplicator] Error checking deduplication:`, error);
      // On error, allow the event through (fail open)
      return {
        isDuplicate: false,
      };
    }
  }

  /**
   * Store an event for deduplication
   */
  private async store(event: AnyEvent, key: string): Promise<void> {
    try {
      await this.redis.setex(key, Math.ceil(this.windowMs / 1000), JSON.stringify(event));
    } catch (error) {
      console.error(`[EventDeduplicator] Error storing event:`, error);
    }
  }

  /**
   * Generate deduplication key for an event
   */
  private generateKey(event: AnyEvent): string {
    switch (this.strategy) {
      case DeduplicationStrategy.ID:
        return `${this.keyPrefix}id:${event.id}`;

      case DeduplicationStrategy.SIGNATURE:
        return this.generateSignatureKey(event);

      case DeduplicationStrategy.KEY:
        return this.generateKeyKey(event);

      case DeduplicationStrategy.CUSTOM:
        if (!this.customKeyFn) {
          throw new Error('Custom key function not provided');
        }
        return `${this.keyPrefix}custom:${this.customKeyFn(event)}`;

      default:
        return `${this.keyPrefix}id:${event.id}`;
    }
  }

  /**
   * Generate key based on transaction signature
   */
  private generateSignatureKey(event: AnyEvent): string {
    // For events with txSignature in data
    const txSig = (event.data as any)?.txSignature;
    if (txSig) {
      return `${this.keyPrefix}sig:${txSig}`;
    }

    // Fall back to event ID
    return `${this.keyPrefix}id:${event.id}`;
  }

  /**
   * Generate key based on event type and key fields
   */
  private generateKeyKey(event: AnyEvent): string {
    switch (event.type) {
      case 'BURN_DETECTED':
        return `${this.keyPrefix}burn:${(event.data as any).token}:${(event.data as any).txSignature}`;

      case 'LIQUIDITY_CHANGED':
        return `${this.keyPrefix}liquidity:${(event.data as any).poolAddress}`;

      case 'MARKET_DISCOVERED':
        return `${this.keyPrefix}market:${(event.data as any).marketAddress}`;

      case 'TOKEN_VALIDATED':
        return `${this.keyPrefix}validation:${(event.data as any).token}:${Math.floor(Date.now() / 60000)}`; // Per-minute key

      case 'POOL_DISCOVERED':
        return `${this.keyPrefix}pool:${(event.data as any).poolAddress}`;

      case 'TRADE_EXECUTED':
        return `${this.keyPrefix}trade:${(event.data as any).tradeId}`;

      case 'POSITION_OPENED':
      case 'POSITION_CLOSED':
        return `${this.keyPrefix}position:${(event.data as any).positionId}`;

      default:
        return `${this.keyPrefix}${event.type}:${event.id}`;
    }
  }

  /**
   * Clear deduplication cache for a specific event
   */
  async clear(event: AnyEvent): Promise<void> {
    const key = this.generateKey(event);
    try {
      await this.redis.del(key);
    } catch (error) {
      console.error(`[EventDeduplicator] Error clearing deduplication:`, error);
    }
  }

  /**
   * Clear all deduplication keys matching a pattern
   */
  async clearPattern(pattern: string): Promise<number> {
    const fullPattern = `${this.keyPrefix}${pattern}`;
    let count = 0;

    try {
      const keys = await this.redis.keys(fullPattern);

      if (keys.length > 0) {
        count = await this.redis.del(...keys);
      }
    } catch (error) {
      console.error(`[EventDeduplicator] Error clearing pattern:`, error);
    }

    return count;
  }

  /**
   * Get statistics about deduplication
   */
  async getStats(): Promise<{
    totalKeys: number;
    keysByType: Record<string, number>;
  }> {
    try {
      const keys = await this.redis.keys(`${this.keyPrefix}*`);
      const keysByType: Record<string, number> = {};

      for (const key of keys) {
        // Extract type from key pattern
        const match = key.match(/dedup:([^:]+)/);
        if (match && match[1]) {
          const type = match[1];
          keysByType[type] = (keysByType[type] || 0) + 1;
        }
      }

      return {
        totalKeys: keys.length,
        keysByType,
      };
    } catch (error) {
      console.error(`[EventDeduplicator] Error getting stats:`, error);
      return {
        totalKeys: 0,
        keysByType: {},
      };
    }
  }
}

/**
 * In-memory deduplicator for testing or local use
 */
export class InMemoryEventDeduplicator {
  private events: Map<string, { event: AnyEvent; expiresAt: number }>;
  private windowMs: number;
  private strategy: DeduplicationStrategy;
  private customKeyFn?: (event: AnyEvent) => string;

  constructor(
    windowMs: number = 5 * 60 * 1000,
    strategy: DeduplicationStrategy = DeduplicationStrategy.ID,
    customKeyFn?: (event: AnyEvent) => string,
  ) {
    this.events = new Map();
    this.windowMs = windowMs;
    this.strategy = strategy;
    this.customKeyFn = customKeyFn;

    // Clean up expired entries periodically
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if an event is a duplicate
   */
  async check(event: AnyEvent): Promise<DeduplicationResult> {
    const key = this.generateKey(event);
    const now = Date.now();

    // Clean up expired entries first
    this.cleanup();

    const existing = this.events.get(key);

    if (existing && existing.expiresAt > now) {
      const firstSeen = new Date(existing.event.timestamp).getTime();
      const timeSinceFirstSeen = now - firstSeen;

      return {
        isDuplicate: true,
        existingEvent: existing.event,
        timeSinceFirstSeen,
      };
    }

    // Store new event
    this.events.set(key, {
      event,
      expiresAt: now + this.windowMs,
    });

    return {
      isDuplicate: false,
    };
  }

  /**
   * Generate deduplication key (same logic as Redis version)
   */
  private generateKey(event: AnyEvent): string {
    switch (this.strategy) {
      case DeduplicationStrategy.ID:
        return `id:${event.id}`;

      case DeduplicationStrategy.SIGNATURE:
        const txSig = (event.data as any)?.txSignature;
        if (txSig) {
          return `sig:${txSig}`;
        }
        return `id:${event.id}`;

      case DeduplicationStrategy.KEY:
        switch (event.type) {
          case 'BURN_DETECTED':
            return `burn:${(event.data as any).token}:${(event.data as any).txSignature}`;
          case 'MARKET_DISCOVERED':
            return `market:${(event.data as any).marketAddress}`;
          case 'TOKEN_VALIDATED':
            return `validation:${(event.data as any).token}:${Math.floor(Date.now() / 60000)}`;
          default:
            return `${event.type}:${event.id}`;
        }

      case DeduplicationStrategy.CUSTOM:
        if (!this.customKeyFn) {
          throw new Error('Custom key function not provided');
        }
        return `custom:${this.customKeyFn(event)}`;

      default:
        return `id:${event.id}`;
    }
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.events.entries()) {
      if (value.expiresAt < now) {
        this.events.delete(key);
      }
    }
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.events.clear();
  }

  /**
   * Get current size
   */
  size(): number {
    return this.events.size;
  }
}

/**
 * Create a deduplicator based on environment
 */
export function createDeduplicator(
  options: DeduplicationOptions,
): EventDeduplicator | InMemoryEventDeduplicator {
  // Use in-memory if no Redis provided
  if (!options.redis) {
    return new InMemoryEventDeduplicator(options.windowMs, options.strategy, options.customKeyFn);
  }

  return new EventDeduplicator(options);
}

/**
 * Middleware-style deduplication wrapper for event handlers
 */
export function withDeduplication<T extends AnyEvent>(
  handler: (event: T) => Promise<void>,
  deduplicator: EventDeduplicator | InMemoryEventDeduplicator,
  onDuplicate?: (event: T, existing: AnyEvent) => void,
): (event: T) => Promise<void> {
  return async (event: T) => {
    const result = await deduplicator.check(event);

    if (result.isDuplicate) {
      if (onDuplicate && result.existingEvent) {
        onDuplicate(event, result.existingEvent);
      }
      return;
    }

    await handler(event);
  };
}

/**
 * Batch deduplication check
 */
export async function checkBatch<T extends AnyEvent>(
  events: T[],
  deduplicator: EventDeduplicator | InMemoryEventDeduplicator,
): Promise<{
  duplicates: T[];
  newEvents: T[];
}> {
  const duplicates: T[] = [];
  const newEvents: T[] = [];

  for (const event of events) {
    const result = await deduplicator.check(event);

    if (result.isDuplicate) {
      duplicates.push(event);
    } else {
      newEvents.push(event);
    }
  }

  return { duplicates, newEvents };
}
