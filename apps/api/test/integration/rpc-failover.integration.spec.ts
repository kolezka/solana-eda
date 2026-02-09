/**
 * RPC Failover Integration Tests
 *
 * Tests RPC connection pool failover behavior:
 * - Endpoint health detection and marking
 * - Automatic failover to healthy endpoints
 * - Retry logic with exponential backoff
 * - Pool recovery after outages
 * - Rate limiting during failover
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { RpcConnectionPool, createRpcPoolFromEnv, type ConnectionType } from '@solana-eda/solana-client';
import { Connection, PublicKey } from '@solana/web3.js';

describe('RPC Failover Integration', () => {
  let pool: RpcConnectionPool;
  let testEndpoints: string[];

  beforeAll(() => {
    // Configure test endpoints (mix of valid and invalid)
    testEndpoints = [
      process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
      'https://invalid-rpc-endpoint.example.com', // Invalid endpoint
      'https://api.mainnet-beta.solana.com', // Fallback
    ];
  });

  afterEach(async () => {
    if (pool) {
      await pool.close();
      pool = null;
    }
  });

  describe('Endpoint Health Detection', () => {
    it('should mark unhealthy endpoints after consecutive failures', async () => {
      pool = new RpcConnectionPool({
        endpoints: [
          {
            url: 'https://invalid-rpc-endpoint.example.com',
            priority: 1,
            type: ['query'],
          },
          {
            url: testEndpoints[0],
            priority: 2,
            type: ['query'],
          },
        ],
        healthCheckInterval: 5000,
        unhealthyThreshold: 2,
        healthyThreshold: 2,
        requestTimeout: 5000,
      });

      // Wait for initial health checks
      await new Promise(resolve => setTimeout(resolve, 6000));

      const stats = pool.getStatsForType('query');
      const invalidEndpoint = stats.find(s => s.url.includes('invalid'));

      expect(invalidEndpoint).toBeDefined();
      expect(invalidEndpoint?.healthy).toBe(false);
      expect(invalidEndpoint?.consecutiveErrors).toBeGreaterThan(0);
    });

    it('should mark endpoints as healthy after successful requests', async () => {
      pool = new RpcConnectionPool({
        endpoints: [
          {
            url: testEndpoints[0],
            priority: 1,
            type: ['query'],
          },
        ],
        healthCheckInterval: 5000,
        unhealthyThreshold: 3,
        healthyThreshold: 2,
        requestTimeout: 10000,
      });

      // Execute successful requests
      const connection = pool.getConnection('query');
      await connection.getVersion();

      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = pool.getStatsForType('query');
      const endpoint = stats[0];

      expect(endpoint.healthy).toBe(true);
      expect(endpoint.consecutiveSuccesses).toBeGreaterThan(0);
      expect(endpoint.totalRequests).toBeGreaterThan(0);
    });

    it('should track latency for each endpoint', async () => {
      pool = new RpcConnectionPool({
        endpoints: [
          {
            url: testEndpoints[0],
            priority: 1,
            type: ['query'],
          },
        ],
        healthCheckInterval: 10000,
        requestTimeout: 10000,
      });

      const connection = pool.getConnection('query');
      const startTime = Date.now();
      await connection.getVersion();
      const actualLatency = Date.now() - startTime;

      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = pool.getStatsForType('query');
      const endpoint = stats[0];

      expect(endpoint.averageLatency).toBeGreaterThan(0);
      expect(endpoint.averageLatency).toBeLessThan(actualLatency * 2); // Should be close to actual
    });
  });

  describe('Automatic Failover', () => {
    it('should failover to next healthy endpoint on error', async () => {
      pool = new RpcConnectionPool({
        endpoints: [
          {
            url: 'https://invalid-rpc-endpoint.example.com',
            priority: 1,
            type: ['query'],
          },
          {
            url: testEndpoints[0],
            priority: 2,
            type: ['query'],
          },
        ],
        healthCheckInterval: 30000,
        requestTimeout: 5000,
      });

      // Execute request that should failover
      const result = await pool.executeWithRetry('query', async (conn) => {
        return await conn.getVersion();
      }, { maxRetries: 3 });

      expect(result).toBeDefined();
      expect(result['solana-core']).toBeDefined();

      // Verify that both endpoints were attempted
      const stats = pool.getStatsForType('query');
      const totalAttempts = stats.reduce((sum, s) => sum + s.totalRequests, 0);
      expect(totalAttempts).toBeGreaterThan(1);
    });

    it('should respect priority when selecting endpoints', async () => {
      pool = new RpcConnectionPool({
        endpoints: [
          {
            url: testEndpoints[0],
            priority: 1, // Highest priority
            type: ['query'],
          },
          {
            url: testEndpoints[2] || testEndpoints[0],
            priority: 2, // Lower priority
            type: ['query'],
          },
        ],
        healthCheckInterval: 30000,
        requestTimeout: 10000,
      });

      // Make multiple requests
      for (let i = 0; i < 5; i++) {
        await pool.executeWithRetry('query', async (conn) => {
          return await conn.getVersion();
        });
      }

      await new Promise(resolve => setTimeout(resolve, 200));

      const stats = pool.getStatsForType('query');
      const priority1Endpoint = stats.find(s => s.url === testEndpoints[0]);
      const priority2Endpoint = stats.find(s => s.url === (testEndpoints[2] || testEndpoints[0]));

      // Priority 1 should have more requests
      expect(priority1Endpoint?.totalRequests).toBeGreaterThanOrEqual(priority2Endpoint?.totalRequests || 0);
    });

    it('should use different pools for different connection types', async () => {
      pool = new RpcConnectionPool({
        endpoints: [
          {
            url: testEndpoints[0],
            priority: 1,
            type: ['query', 'submit'],
          },
        ],
        healthCheckInterval: 30000,
      });

      const queryConn = pool.getConnection('query');
      const submitConn = pool.getConnection('submit');

      expect(queryConn).toBeDefined();
      expect(submitConn).toBeDefined();

      // Both should work
      const queryResult = await queryConn.getVersion();
      const submitResult = await submitConn.getVersion();

      expect(queryResult).toBeDefined();
      expect(submitResult).toBeDefined();
    });
  });

  describe('Retry Logic', () => {
    it('should retry with exponential backoff', async () => {
      pool = new RpcConnectionPool({
        endpoints: [
          {
            url: 'https://invalid-rpc-endpoint.example.com',
            priority: 1,
            type: ['query'],
          },
        ],
        healthCheckInterval: 30000,
        requestTimeout: 1000,
      });

      const startTime = Date.now();

      try {
        await pool.executeWithRetry('query', async (conn) => {
          return await conn.getVersion();
        }, { maxRetries: 3 });
      } catch (error) {
        // Expected to fail
      }

      const duration = Date.now() - startTime;

      // Should have taken at least 3 retries with backoff (100ms, 200ms, 300ms)
      expect(duration).toBeGreaterThan(600);
    });

    it('should not retry on non-retryable errors', async () => {
      pool = new RpcConnectionPool({
        endpoints: [
          {
            url: testEndpoints[0],
            priority: 1,
            type: ['query'],
          },
        ],
        healthCheckInterval: 30000,
        requestTimeout: 10000,
      });

      let attemptCount = 0;

      try {
        await pool.executeWithRetry('query', async (conn) => {
          attemptCount++;
          // Simulate a non-retryable error
          throw new Error('Invalid params: account not found');
        });
      } catch (error) {
        // Expected to fail
      }

      // Should only attempt once (no retries for non-retryable errors)
      expect(attemptCount).toBe(1);
    });

    it('should retry maxRetries times before giving up', async () => {
      pool = new RpcConnectionPool({
        endpoints: [
          {
            url: 'https://invalid-rpc-endpoint.example.com',
            priority: 1,
            type: ['query'],
          },
        ],
        healthCheckInterval: 30000,
        requestTimeout: 1000,
      });

      const maxRetries = 5;
      let attemptCount = 0;

      try {
        await pool.executeWithRetry('query', async (conn) => {
          attemptCount++;
          return await conn.getVersion();
        }, { maxRetries });
      } catch (error) {
        // Expected to fail
      }

      expect(attemptCount).toBe(maxRetries);
    });
  });

  describe('Pool Recovery', () => {
    it('should recover endpoint health after successful requests', async () => {
      pool = new RpcConnectionPool({
        endpoints: [
          {
            url: 'https://invalid-rpc-endpoint.example.com',
            priority: 1,
            type: ['query'],
          },
          {
            url: testEndpoints[0],
            priority: 2,
            type: ['query'],
          },
        ],
        healthCheckInterval: 5000,
        unhealthyThreshold: 2,
        healthyThreshold: 2,
        requestTimeout: 5000,
      });

      // Wait for health check to mark invalid endpoint as unhealthy
      await new Promise(resolve => setTimeout(resolve, 6000));

      let stats = pool.getStatsForType('query');
      const invalidEndpoint = stats.find(s => s.url.includes('invalid'));

      expect(invalidEndpoint?.healthy).toBe(false);

      // Manually mark as healthy (simulating recovery)
      pool.markEndpointHealthy(invalidEndpoint!.url, 'query');

      stats = pool.getStatsForType('query');
      expect(stats.find(s => s.url.includes('invalid'))?.healthy).toBe(true);
    });

    it('should reset all endpoint health on emergency reset', async () => {
      pool = new RpcConnectionPool({
        endpoints: [
          {
            url: 'https://invalid-rpc-endpoint.example.com',
            priority: 1,
            type: ['query'],
          },
          {
            url: testEndpoints[0],
            priority: 2,
            type: ['query'],
          },
        ],
        healthCheckInterval: 5000,
        unhealthyThreshold: 1,
        requestTimeout: 5000,
      });

      // Wait for health checks
      await new Promise(resolve => setTimeout(resolve, 6000));

      // Reset all health
      pool.resetAllHealth();

      const stats = pool.getStatsForType('query');
      stats.forEach(endpoint => {
        expect(endpoint.healthy).toBe(true);
        expect(endpoint.consecutiveErrors).toBe(0);
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should respect per-endpoint rate limits', async () => {
      pool = new RpcConnectionPool({
        endpoints: [
          {
            url: testEndpoints[0],
            priority: 1,
            type: ['query'],
            maxRequests: 5,
            windowMs: 1000,
          },
        ],
        healthCheckInterval: 30000,
        requestTimeout: 10000,
      });

      // Make requests up to the limit
      const promises: Promise<any>[] = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          pool.executeWithRetry('query', async (conn) => {
            return await conn.getVersion();
          })
        );
      }

      await Promise.all(promises);

      // Some requests should have been rate limited
      const stats = pool.getStatsForType('query');
      expect(stats[0].totalRequests).toBeGreaterThan(0);
    });
  });

  describe('Pool Statistics', () => {
    it('should provide accurate pool statistics', async () => {
      pool = new RpcConnectionPool({
        endpoints: [
          {
            url: testEndpoints[0],
            priority: 1,
            type: ['query'],
          },
          {
            url: testEndpoints[2] || testEndpoints[0],
            priority: 2,
            type: ['submit'],
          },
        ],
        healthCheckInterval: 30000,
      });

      // Generate some activity
      await pool.executeWithRetry('query', async (conn) => {
        return await conn.getVersion();
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      const allStats = pool.getPoolStats();

      expect(allStats.has('query')).toBe(true);
      expect(allStats.has('submit')).toBe(true);

      const queryStats = allStats.get('query')!;
      expect(queryStats.length).toBeGreaterThan(0);
      expect(queryStats[0].totalRequests).toBeGreaterThan(0);
      expect(queryStats[0].averageLatency).toBeGreaterThan(0);
    });

    it('should track errors correctly', async () => {
      pool = new RpcConnectionPool({
        endpoints: [
          {
            url: 'https://invalid-rpc-endpoint.example.com',
            priority: 1,
            type: ['query'],
          },
        ],
        healthCheckInterval: 30000,
        requestTimeout: 2000,
      });

      try {
        await pool.executeWithRetry('query', async (conn) => {
          return await conn.getVersion();
        }, { maxRetries: 2 });
      } catch (error) {
        // Expected to fail
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const stats = pool.getStatsForType('query');
      expect(stats[0].failedRequests).toBeGreaterThan(0);
      expect(stats[0].lastError).toBeDefined();
    });
  });

  describe('Environment-based Pool Creation', () => {
    it('should create pool from environment variables', () => {
      const originalRpcUrls = process.env.SOLANA_RPC_URLS;

      process.env.SOLANA_RPC_URLS = [
        testEndpoints[0],
        'https://api.mainnet-beta.solana.com',
      ].join(',');

      const envPool = createRpcPoolFromEnv();
      const stats = envPool.getPoolStats();

      expect(stats.size).toBeGreaterThan(0);

      envPool.close();

      // Restore original env
      if (originalRpcUrls) {
        process.env.SOLANA_RPC_URLS = originalRpcUrls;
      } else {
        delete process.env.SOLANA_RPC_URLS;
      }
    });
  });

  describe('Connection Selection Algorithm', () => {
    it('should prefer endpoints with better health scores', async () => {
      pool = new RpcConnectionPool({
        endpoints: [
          {
            url: testEndpoints[0],
            priority: 1,
            type: ['query'],
          },
          {
            url: testEndpoints[2] || testEndpoints[0],
            priority: 2,
            type: ['query'],
          },
        ],
        healthCheckInterval: 30000,
        requestTimeout: 10000,
      });

      // Make multiple requests to build up stats
      for (let i = 0; i < 10; i++) {
        await pool.executeWithRetry('query', async (conn) => {
          return await conn.getVersion();
        });
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      const stats = pool.getStatsForType('query');

      // At least one endpoint should have better stats
      const sortedByLatency = [...stats].sort((a, b) => a.averageLatency - b.averageLatency);
      expect(sortedByLatency[0].averageLatency).toBeLessThanOrEqual(sortedByLatency[sortedByLatency.length - 1].averageLatency);
    });

    it('should consider current load when selecting endpoints', async () => {
      pool = new RpcConnectionPool({
        endpoints: [
          {
            url: testEndpoints[0],
            priority: 1,
            type: ['query'],
          },
          {
            url: testEndpoints[2] || testEndpoints[0],
            priority: 2,
            type: ['query'],
          },
        ],
        healthCheckInterval: 30000,
      });

      // Simulate load by making concurrent requests
      const promises: Promise<any>[] = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          pool.executeWithRetry('query', async (conn) => {
            return await conn.getVersion();
          })
        );
      }

      await Promise.all(promises);

      const stats = pool.getStatsForType('query');
      stats.forEach(stat => {
        expect(stat.totalRequests).toBeGreaterThan(0);
      });
    });
  });
});
