/**
 * Integration Test Configuration
 *
 * Shared setup and utilities for integration tests
 */

import { Redis } from 'ioredis';
import { Connection } from '@solana/web3.js';

export interface TestEnvironment {
  redis: Redis;
  solanaConnection: Connection;
  rabbitmqUrl?: string;
}

export function getTestEnvironment(): TestEnvironment {
  return {
    redis: new Redis(process.env.REDIS_URL || 'redis://localhost:6379'),
    solanaConnection: new Connection(
      process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
      'confirmed'
    ),
    rabbitmqUrl: process.env.RABBITMQ_URL,
  };
}

export async function setupTestEnvironment(): Promise<TestEnvironment> {
  const env = getTestEnvironment();

  // Clear Redis test data
  await env.redis.flushdb();

  return env;
}

export async function teardownTestEnvironment(env: TestEnvironment): Promise<void> {
  await env.redis.flushdb();
  await env.redis.quit();
}

export function generateTestTokenMint(): string {
  return `TestToken${Date.now()}`;
}

export function generateTestSignature(): string {
  return `test_signature_${Math.random().toString(36).substring(7)}`;
}

export function generateTestSlot(): number {
  return Math.floor(Math.random() * 1000000);
}

export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

export function createMockWebSocket(): any {
  return {
    on: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
    readyState: 1, // OPEN
  };
}

export function createMockConnection(): any {
  return {
    getVersion: jest.fn().mockResolvedValue({
      'solana-core': '1.14.0',
    }),
    getAccountInfo: jest.fn().mockResolvedValue(null),
    getBalance: jest.fn().mockResolvedValue(1000000),
    getRecentPrioritizationFees: jest.fn().mockResolvedValue([
      { prioritizationFee: 1000 },
      { prioritizationFee: 2000 },
      { prioritizationFee: 1500 },
    ]),
    onAccountChange: jest.fn().mockReturnValue(1),
    onLogs: jest.fn().mockReturnValue(2),
    removeAccountChangeListener: jest.fn(),
    removeOnLogsListener: jest.fn(),
  };
}

export class TestEventCollector {
  private events: Map<string, any[]> = new Map();

  collect(eventType: string, event: any): void {
    if (!this.events.has(eventType)) {
      this.events.set(eventType, []);
    }
    this.events.get(eventType)!.push(event);
  }

  getEvents(eventType: string): any[] {
    return this.events.get(eventType) || [];
  }

  getAllEvents(): Map<string, any[]> {
    return this.events;
  }

  clear(): void {
    this.events.clear();
  }

  count(eventType?: string): number {
    if (eventType) {
      return this.getEvents(eventType).length;
    }
    return Array.from(this.events.values()).reduce((sum, events) => sum + events.length, 0);
  }

  waitForEvent(eventType: string, timeout: number = 5000): Promise<any> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const checkInterval = setInterval(() => {
        const events = this.getEvents(eventType);
        if (events.length > 0) {
          clearInterval(checkInterval);
          resolve(events[events.length - 1]);
        } else if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          reject(new Error(`No event of type ${eventType} received within ${timeout}ms`));
        }
      }, 100);
    });
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 100
): Promise<T> {
  return new Promise((resolve, reject) => {
    let attempt = 0;

    const attemptFn = async () => {
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        attempt++;
        if (attempt >= maxRetries) {
          reject(error);
        } else {
          setTimeout(attemptFn, delay * attempt);
        }
      }
    };

    attemptFn();
  });
}
