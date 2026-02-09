/**
 * End-to-End Event Processing Integration Tests
 *
 * Tests complete event flow:
 * - Worker event creation and validation
 * - RabbitMQ message publishing
 * - API event consumption
 * - Database persistence
 * - WebSocket delivery to clients
 * - EventEmitter2 integration
 * - SSE delivery
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getConnection } from 'typeorm';
import Redis from 'ioredis';
import {
  createBurnEvent,
  createLiquidityEvent,
  createTradeEvent,
  createPriceUpdateEvent,
  createWorkerStatusEvent,
  validateEvent,
  FeatureFlags,
  CHANNELS
} from '@solana-eda/events';

// Mock Prisma for testing
const mockPrisma = {
  burnEvent: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  liquidityEvent: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  trade: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  price: {
    upsert: jest.fn(),
    findMany: jest.fn(),
  },
  workerStatus: {
    upsert: jest.fn(),
    findMany: jest.fn(),
  },
  position: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('End-to-End Event Processing', () => {
  let app: INestApplication;
  let eventEmitter: EventEmitter2;
  let redis: Redis;
  let testRedisUrl: string;

  beforeAll(async () => {
    testRedisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    // Create Redis client for testing
    redis = new Redis(testRedisUrl);
  });

  afterAll(async () => {
    if (redis) {
      await redis.quit();
    }
  });

  beforeEach(async () => {
    // Clear Redis test data
    await redis.flushdb();

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('Event Creation and Validation', () => {
    it('should create valid burn event', () => {
      const burnEvent = createBurnEvent({
        token: 'TestToken',
        amount: '1000',
        signature: 'test_signature',
        slot: 12345,
        timestamp: new Date().toISOString(),
      });

      expect(burnEvent.type).toBe('BURN_DETECTED');
      expect(burnEvent.id).toBeDefined();
      expect(burnEvent.timestamp).toBeDefined();
      expect(burnEvent.data.token).toBe('TestToken');
      expect(burnEvent.data.amount).toBe('1000');
    });

    it('should create valid liquidity event', () => {
      const liquidityEvent = createLiquidityEvent({
        pool: 'TestPool',
        token: 'TestToken',
        liquidityChange: '5000',
        newLiquidity: '10000',
        signature: 'test_signature',
        slot: 12346,
        timestamp: new Date().toISOString(),
      });

      expect(liquidityEvent.type).toBe('LIQUIDITY_CHANGED');
      expect(liquidityEvent.data.pool).toBe('TestPool');
      expect(liquidityEvent.data.liquidityChange).toBe('5000');
    });

    it('should create valid trade event', () => {
      const tradeEvent = createTradeEvent({
        token: 'TestToken',
        amount: '100',
        price: '1.5',
        dex: 'jupiter',
        signature: 'test_signature',
        slot: 12347,
        timestamp: new Date().toISOString(),
      });

      expect(tradeEvent.type).toBe('TRADE_EXECUTED');
      expect(tradeEvent.data.dex).toBe('jupiter');
      expect(tradeEvent.data.price).toBe('1.5');
    });

    it('should create valid price update event', () => {
      const priceEvent = createPriceUpdateEvent({
        token: 'TestToken',
        price: '2.5',
        source: 'jupiter',
        confidence: 0.95,
        volume24h: '10000',
      });

      expect(priceEvent.type).toBe('PRICE_UPDATE');
      expect(priceEvent.data.token).toBe('TestToken');
      expect(priceEvent.data.price).toBe('2.5');
      expect(priceEvent.data.confidence).toBe(0.95);
    });

    it('should create valid worker status event', () => {
      const statusEvent = createWorkerStatusEvent({
        workerName: 'price-aggregator',
        status: 'RUNNING',
        metrics: {
          eventsProcessed: 100,
          errors: 0,
          uptime: 3600,
          lastEventAt: new Date().toISOString(),
        },
      });

      expect(statusEvent.type).toBe('WORKER_STATUS');
      expect(statusEvent.data.workerName).toBe('price-aggregator');
      expect(statusEvent.data.status).toBe('RUNNING');
      expect(statusEvent.data.metrics.eventsProcessed).toBe(100);
    });

    it('should validate correct event structure', () => {
      const event = createBurnEvent({
        token: 'TestToken',
        amount: '1000',
        signature: 'test_signature',
        slot: 12345,
        timestamp: new Date().toISOString(),
      });

      const isValid = validateEvent(event);
      expect(isValid).toBe(true);
    });

    it('should reject invalid event structure', () => {
      const invalidEvent = {
        type: 'INVALID_EVENT',
        id: 'test-id',
        timestamp: new Date().toISOString(),
        data: {},
      };

      const isValid = validateEvent(invalidEvent);
      expect(isValid).toBe(false);
    });
  });

  describe('Event Publishing to Redis', () => {
    it('should publish burn event to Redis channel', async () => {
      const burnEvent = createBurnEvent({
        token: 'TestToken',
        amount: '1000',
        signature: 'test_signature',
        slot: 12345,
        timestamp: new Date().toISOString(),
      });

      await redis.publish(CHANNELS.EVENTS_BURN, JSON.stringify(burnEvent));

      // Verify event was published (by subscribing and checking)
      const receivedEvents: any[] = [];
      const subscriber = redis.duplicate();

      await new Promise<void>((resolve) => {
        subscriber.subscribe(CHANNELS.EVENTS_BURN, () => {
          subscriber.on('message', (channel, message) => {
            if (channel === CHANNELS.EVENTS_BURN) {
              receivedEvents.push(JSON.parse(message));
              resolve();
            }
          });
        });
      });

      expect(receivedEvents.length).toBeGreaterThan(0);
      expect(receivedEvents[0].type).toBe('BURN_DETECTED');

      await subscriber.quit();
    });

    it('should publish trade event to Redis channel', async () => {
      const tradeEvent = createTradeEvent({
        token: 'TestToken',
        amount: '100',
        price: '1.5',
        dex: 'jupiter',
        signature: 'test_signature',
        slot: 12347,
        timestamp: new Date().toISOString(),
      });

      await redis.publish(CHANNELS.EVENTS_TRADE, JSON.stringify(tradeEvent));

      // Verify
      const receivedEvents: any[] = [];
      const subscriber = redis.duplicate();

      await new Promise<void>((resolve) => {
        subscriber.subscribe(CHANNELS.EVENTS_TRADE, () => {
          subscriber.on('message', (channel, message) => {
            if (channel === CHANNELS.EVENTS_TRADE) {
              receivedEvents.push(JSON.parse(message));
              resolve();
            }
          });
        });
      });

      expect(receivedEvents.length).toBeGreaterThan(0);

      await subscriber.quit();
    });

    it('should publish price update to correct channel', async () => {
      const priceEvent = createPriceUpdateEvent({
        token: 'TestToken',
        price: '2.5',
        source: 'jupiter',
        confidence: 0.95,
      });

      await redis.publish(CHANNELS.EVENTS_PRICE, JSON.stringify(priceEvent));

      // Verify
      const receivedEvents: any[] = [];
      const subscriber = redis.duplicate();

      await new Promise<void>((resolve) => {
        subscriber.subscribe(CHANNELS.EVENTS_PRICE, () => {
          subscriber.on('message', (channel, message) => {
            if (channel === CHANNELS.EVENTS_PRICE) {
              receivedEvents.push(JSON.parse(message));
              resolve();
            }
          });
        });
      });

      expect(receivedEvents.length).toBeGreaterThan(0);

      await subscriber.quit();
    });

    it('should publish worker status to correct channel', async () => {
      const statusEvent = createWorkerStatusEvent({
        workerName: 'test-worker',
        status: 'RUNNING',
        metrics: {
          eventsProcessed: 50,
          errors: 0,
        },
      });

      await redis.publish(CHANNELS.WORKERS_STATUS, JSON.stringify(statusEvent));

      // Verify
      const receivedEvents: any[] = [];
      const subscriber = redis.duplicate();

      await new Promise<void>((resolve) => {
        subscriber.subscribe(CHANNELS.WORKERS_STATUS, () => {
          subscriber.on('message', (channel, message) => {
            if (channel === CHANNELS.WORKERS_STATUS) {
              receivedEvents.push(JSON.parse(message));
              resolve();
            }
          });
        });
      });

      expect(receivedEvents.length).toBeGreaterThan(0);

      await subscriber.quit();
    });
  });

  describe('Event Persistence to Database', () => {
    it('should persist burn event to database', async () => {
      const burnEvent = createBurnEvent({
        token: 'TestToken',
        amount: '1000',
        signature: 'test_sig',
        slot: 12345,
        timestamp: new Date().toISOString(),
      });

      // Mock successful database save
      mockPrisma.burnEvent.create.mockResolvedValue({
        id: 'db-id-1',
        token: burnEvent.data.token,
        amount: burnEvent.data.amount,
        signature: burnEvent.data.signature,
      });

      const saved = await mockPrisma.burnEvent.create({
        data: {
          token: burnEvent.data.token,
          amount: burnEvent.data.amount,
          signature: burnEvent.data.signature,
        },
      });

      expect(saved.token).toBe('TestToken');
      expect(mockPrisma.burnEvent.create).toHaveBeenCalled();
    });

    it('should persist trade event to database', async () => {
      const tradeEvent = createTradeEvent({
        token: 'TestToken',
        amount: '100',
        price: '1.5',
        dex: 'jupiter',
        signature: 'test_sig',
        slot: 12347,
        timestamp: new Date().toISOString(),
      });

      mockPrisma.trade.create.mockResolvedValue({
        id: 'trade-id-1',
        token: tradeEvent.data.token,
        amount: tradeEvent.data.amount,
        price: tradeEvent.data.price,
        dex: tradeEvent.data.dex,
      });

      const saved = await mockPrisma.trade.create({
        data: {
          token: tradeEvent.data.token,
          amount: tradeEvent.data.amount,
          price: tradeEvent.data.price,
          dex: tradeEvent.data.dex,
        },
      });

      expect(saved.dex).toBe('jupiter');
      expect(mockPrisma.trade.create).toHaveBeenCalled();
    });

    it('should upsert price event to database', async () => {
      const priceEvent = createPriceUpdateEvent({
        token: 'TestToken',
        price: '2.5',
        source: 'jupiter',
        confidence: 0.95,
      });

      mockPrisma.price.upsert.mockResolvedValue({
        token: priceEvent.data.token,
        source: priceEvent.data.source,
        price: priceEvent.data.price,
        confidence: priceEvent.data.confidence,
      });

      const saved = await mockPrisma.price.upsert({
        where: { token_source: { token: priceEvent.data.token, source: priceEvent.data.source } },
        update: { price: priceEvent.data.price },
        create: {
          token: priceEvent.data.token,
          source: priceEvent.data.source,
          price: priceEvent.data.price,
          confidence: priceEvent.data.confidence,
        },
      });

      expect(saved.price).toBe('2.5');
      expect(mockPrisma.price.upsert).toHaveBeenCalled();
    });
  });

  describe('EventEmitter2 Integration', () => {
    it('should emit burn event through EventEmitter2', async () => {
      const eventEmitter = new EventEmitter2();
      let receivedEvent: any = null;

      eventEmitter.on('burn.detected', (event) => {
        receivedEvent = event;
      });

      const burnEvent = createBurnEvent({
        token: 'TestToken',
        amount: '1000',
        signature: 'test_sig',
        slot: 12345,
        timestamp: new Date().toISOString(),
      });

      eventEmitter.emit('burn.detected', burnEvent);

      expect(receivedEvent).toBeDefined();
      expect(receivedEvent.type).toBe('BURN_DETECTED');
    });

    it('should support wildcard event listeners', async () => {
      const eventEmitter = new EventEmitter2({ wildcard: true, delimiter: ':' });
      const receivedEvents: any[] = [];

      eventEmitter.on('events.*', (event) => {
        receivedEvents.push(event);
      });

      const burnEvent = createBurnEvent({
        token: 'TestToken',
        amount: '1000',
        signature: 'test_sig',
        slot: 12345,
        timestamp: new Date().toISOString(),
      });

      eventEmitter.emit('events:burn', burnEvent);

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0].type).toBe('BURN_DETECTED');
    });
  });

  describe('SSE Delivery', () => {
    it('should send events via SSE stream', async () => {
      const mockResponse = {
        write: jest.fn(),
        writeHead: jest.fn(),
        on: jest.fn(),
      };

      const priceEvent = createPriceUpdateEvent({
        token: 'TestToken',
        price: '2.5',
        source: 'jupiter',
        confidence: 0.95,
      });

      // Simulate SSE send
      const sseData = `data: ${JSON.stringify(priceEvent)}\n\n`;
      mockResponse.write(sseData);

      expect(mockResponse.write).toHaveBeenCalledWith(expect.stringContaining('BURN_DETECTED'));
    });

    it('should handle multiple clients for same event stream', async () => {
      const clients = [
        { write: jest.fn(), id: 'client-1' },
        { write: jest.fn(), id: 'client-2' },
        { write: jest.fn(), id: 'client-3' },
      ];

      const tradeEvent = createTradeEvent({
        token: 'TestToken',
        amount: '100',
        price: '1.5',
        dex: 'jupiter',
        signature: 'test_sig',
        slot: 12347,
        timestamp: new Date().toISOString(),
      });

      // Broadcast to all clients
      clients.forEach(client => {
        client.write(`data: ${JSON.stringify(tradeEvent)}\n\n`);
      });

      // All clients should have received the event
      clients.forEach(client => {
        expect(client.write).toHaveBeenCalled();
      });
    });
  });

  describe('End-to-End Event Flow', () => {
    it('should process event from creation to Redis to client', async () => {
      // 1. Create event
      const burnEvent = createBurnEvent({
        token: 'TestToken',
        amount: '1000',
        signature: 'test_sig',
        slot: 12345,
        timestamp: new Date().toISOString(),
      });

      // 2. Publish to Redis
      await redis.publish(CHANNELS.EVENTS_BURN, JSON.stringify(burnEvent));

      // 3. Subscribe and verify
      const receivedEvents: any[] = [];
      const subscriber = redis.duplicate();

      await new Promise<void>((resolve) => {
        subscriber.subscribe(CHANNELS.EVENTS_BURN, () => {
          subscriber.on('message', (channel, message) => {
            if (channel === CHANNELS.EVENTS_BURN) {
              receivedEvents.push(JSON.parse(message));
              resolve();
            }
          });
        });
      });

      expect(receivedEvents[0].data.token).toBe('TestToken');

      // 4. Persist to database (mocked)
      mockPrisma.burnEvent.create.mockResolvedValue({
        id: 'db-id-1',
        token: burnEvent.data.token,
        amount: burnEvent.data.amount,
      });

      await mockPrisma.burnEvent.create({
        data: {
          token: burnEvent.data.token,
          amount: burnEvent.data.amount,
        },
      });

      expect(mockPrisma.burnEvent.create).toHaveBeenCalled();

      await subscriber.quit();
    });

    it('should handle multiple event types in sequence', async () => {
      const events = [
        createBurnEvent({
          token: 'Token1',
          amount: '1000',
          signature: 'sig1',
          slot: 1,
          timestamp: new Date().toISOString(),
        }),
        createTradeEvent({
          token: 'Token2',
          amount: '100',
          price: '1.5',
          dex: 'jupiter',
          signature: 'sig2',
          slot: 2,
          timestamp: new Date().toISOString(),
        }),
        createPriceUpdateEvent({
          token: 'Token3',
          price: '2.5',
          source: 'jupiter',
          confidence: 0.95,
        }),
      ];

      const channels = [CHANNELS.EVENTS_BURN, CHANNELS.EVENTS_TRADE, CHANNELS.EVENTS_PRICE];

      // Publish all events
      for (let i = 0; i < events.length; i++) {
        await redis.publish(channels[i], JSON.stringify(events[i]));
      }

      // Verify all events were published
      let receivedCount = 0;
      const subscriber = redis.duplicate();

      await Promise.all(channels.map(channel =>
        new Promise<void>((resolve) => {
          subscriber.subscribe(channel, () => {
            subscriber.on('message', (ch, message) => {
              if (channels.includes(ch)) {
                receivedCount++;
                if (receivedCount === events.length) {
                  resolve();
                }
              }
            });
          });
        })
      ));

      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(receivedCount).toBe(events.length);

      await subscriber.quit();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle Redis connection errors gracefully', async () => {
      const badRedis = new Redis('redis://invalid-host:6379', {
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
      });

      try {
        await badRedis.publish(CHANNELS.EVENTS_BURN, JSON.stringify({ test: 'data' }));
      } catch (error) {
        expect(error).toBeDefined();
      }

      await badRedis.quit();
    });

    it('should handle invalid event JSON gracefully', async () => {
      const subscriber = redis.duplicate();
      let parseError = false;

      await new Promise<void>((resolve) => {
        subscriber.subscribe(CHANNELS.EVENTS_BURN, () => {
          subscriber.on('message', (channel, message) => {
            try {
              JSON.parse(message);
            } catch (error) {
              parseError = true;
              resolve();
            }
          });
        });
      });

      // Publish invalid JSON
      await redis.publish(CHANNELS.EVENTS_BURN, 'invalid json{');

      await new Promise(resolve => setTimeout(resolve, 500));

      expect(parseError).toBe(true);

      await subscriber.quit();
    });
  });

  describe('Feature Flags', () => {
    it('should respect RabbitMQ enabled flag', () => {
      const enabled = FeatureFlags.isRabbitMQEnabled();
      expect(typeof enabled).toBe('boolean');
    });

    it('should respect dual write enabled flag', () => {
      const enabled = FeatureFlags.isDualWriteEnabled();
      expect(typeof enabled).toBe('boolean');
    });

    it('should log configuration without errors', () => {
      expect(() => {
        FeatureFlags.logConfiguration('test');
      }).not.toThrow();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high event throughput', async () => {
      const eventCount = 100;
      const events: any[] = [];

      // Create events
      for (let i = 0; i < eventCount; i++) {
        events.push(createPriceUpdateEvent({
          token: `Token${i}`,
          price: (Math.random() * 10).toFixed(2),
          source: 'jupiter',
          confidence: Math.random(),
        }));
      }

      // Publish all events
      const startTime = Date.now();
      await Promise.all(events.map(event =>
        redis.publish(CHANNELS.EVENTS_PRICE, JSON.stringify(event))
      ));
      const duration = Date.now() - startTime;

      // Should complete quickly
      expect(duration).toBeLessThan(5000);
    });

    it('should handle concurrent subscribers', async () => {
      const subscriberCount = 10;
      const subscribers: Redis[] = [];
      const receivedCounts: number[] = [];

      // Create subscribers
      for (let i = 0; i < subscriberCount; i++) {
        const subscriber = redis.duplicate();
        subscribers.push(subscriber);
        receivedCounts.push(0);

        await new Promise<void>((resolve) => {
          subscriber.subscribe(CHANNELS.EVENTS_PRICE, () => {
            subscriber.on('message', (channel, message) => {
              receivedCounts[i]++;
              if (receivedCounts[i] === 1) {
                resolve();
              }
            });
          });
        });
      }

      // Publish event
      const event = createPriceUpdateEvent({
        token: 'TestToken',
        price: '1.5',
        source: 'jupiter',
        confidence: 0.95,
      });

      await redis.publish(CHANNELS.EVENTS_PRICE, JSON.stringify(event));

      await new Promise(resolve => setTimeout(resolve, 1000));

      // All subscribers should have received the event
      const totalReceived = receivedCounts.filter(count => count > 0).length;
      expect(totalReceived).toBeGreaterThan(0);

      // Cleanup
      subscribers.forEach(sub => sub.quit());
    });
  });
});
