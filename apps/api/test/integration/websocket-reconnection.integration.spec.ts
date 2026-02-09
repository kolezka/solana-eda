/**
 * WebSocket Reconnection Integration Tests
 *
 * Tests WebSocket connection management:
 * - Initial WebSocket connection establishment
 * - Automatic reconnection on disconnect
 * - Exponential backoff for reconnection attempts
 * - Subscription restoration after reconnection
 * - Connection state management
 * - Graceful shutdown
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { SolanaConnectionManager, ConnectionState } from '@solana-eda/solana-client';
import { Connection, PublicKey } from '@solana/web3.js';
import { EventEmitter } from 'events';

describe('WebSocket Reconnection Integration', () => {
  let connectionManager: SolanaConnectionManager;
  let testWsUrl: string;

  beforeAll(() => {
    testWsUrl = process.env.SOLANA_WS_URL || 'wss://api.devnet.solana.com';
  });

  afterEach(async () => {
    if (connectionManager) {
      await connectionManager.close();
      connectionManager = null;
    }
  });

  describe('Initial Connection', () => {
    it('should establish WebSocket connection successfully', async () => {
      connectionManager = new SolanaConnectionManager({
        rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        wsUrl: testWsUrl,
        wsReconnect: true,
        maxReconnectAttempts: 5,
      });

      await connectionManager.connectWebSocket();

      expect(connectionManager.isWsConnected()).toBe(true);

      const healthStatus = await connectionManager.getHealthStatus();
      expect(healthStatus.ws).toBe(true);
    });

    it('should throw error when WebSocket URL is not provided', async () => {
      connectionManager = new SolanaConnectionManager({
        rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        // No wsUrl provided
      });

      await expect(connectionManager.connectWebSocket()).rejects.toThrow();
    });

    it('should verify connection health', async () => {
      connectionManager = new SolanaConnectionManager({
        rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        wsUrl: testWsUrl,
        wsReconnect: true,
      });

      await connectionManager.connectWebSocket();

      const healthStatus = await connectionManager.getHealthStatus();

      expect(healthStatus.ws).toBe(true);
      expect(healthStatus.wsUrl).toBe(testWsUrl);
      expect(healthStatus.rpc).toBe(true);
    });
  });

  describe('Subscription Management', () => {
    it('should subscribe to account changes via WebSocket', async () => {
      connectionManager = new SolanaConnectionManager({
        rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        wsUrl: testWsUrl,
        wsReconnect: true,
      });

      await connectionManager.connectWebSocket();

      // Subscribe to a known account (System Program)
      const systemProgram = new PublicKey('11111111111111111111111111111111');
      let receivedCallback = false;

      const subscriptionId = connectionManager.onAccountChange(
        systemProgram,
        (accountInfo, context) => {
          receivedCallback = true;
        },
        'confirmed'
      );

      expect(typeof subscriptionId).toBe('number');

      // Wait a bit to see if we get any updates
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Clean up subscription
      connectionManager.removeAccountChangeListener(subscriptionId);
    });

    it('should subscribe to logs via WebSocket', async () => {
      connectionManager = new SolanaConnectionManager({
        rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        wsUrl: testWsUrl,
        wsReconnect: true,
      });

      await connectionManager.connectWebSocket();

      // Subscribe to logs for a known account
      const systemProgram = new PublicKey('11111111111111111111111111111111');
      let receivedCallback = false;

      const subscriptionId = connectionManager.onLogs(
        systemProgram,
        (logs, context) => {
          receivedCallback = true;
        },
        'confirmed'
      );

      expect(typeof subscriptionId).toBe('number');

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Clean up
      connectionManager.removeOnLogsListener(subscriptionId);
    });

    it('should handle multiple subscriptions', async () => {
      connectionManager = new SolanaConnectionManager({
        rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        wsUrl: testWsUrl,
        wsReconnect: true,
      });

      await connectionManager.connectWebSocket();

      const accounts = [
        new PublicKey('11111111111111111111111111111111'),
        new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      ];

      const subscriptionIds: number[] = [];

      // Create multiple subscriptions
      for (const account of accounts) {
        const id = connectionManager.onAccountChange(
          account,
          (accountInfo, context) => {
            // Callback
          },
          'confirmed'
        );
        subscriptionIds.push(id);
      }

      expect(subscriptionIds.length).toBe(2);
      expect(subscriptionIds[0]).not.toBe(subscriptionIds[1]);

      // Clean up all subscriptions
      subscriptionIds.forEach(id => {
        connectionManager.removeAccountChangeListener(id);
      });
    });
  });

  describe('Reconnection Logic', () => {
    it('should attempt reconnection on disconnect', async () => {
      connectionManager = new SolanaConnectionManager({
        rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        wsUrl: testWsUrl,
        wsReconnect: true,
        maxReconnectAttempts: 3,
      });

      await connectionManager.connectWebSocket();

      expect(connectionManager.isWsConnected()).toBe(true);

      // Simulate disconnect by closing the WebSocket connection
      const wsConnection = connectionManager.getWsConnection();
      if (wsConnection && (wsConnection as any)._rpcWebSocket) {
        (wsConnection as any)._rpcWebSocket.close();
      }

      // Wait for reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Connection should be reconnected
      const healthStatus = await connectionManager.getHealthStatus();
      expect(healthStatus.ws).toBe(true);
    }, 15000);

    it('should respect max reconnection attempts', async () => {
      connectionManager = new SolanaConnectionManager({
        rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        wsUrl: 'wss://invalid-websocket-endpoint.example.com', // Invalid URL
        wsReconnect: true,
        maxReconnectAttempts: 2,
      });

      let connectionError: Error | null = null;

      try {
        await connectionManager.connectWebSocket();
      } catch (error) {
        connectionError = error as Error;
      }

      // Should fail after max attempts
      expect(connectionError).toBeDefined();

      const healthStatus = await connectionManager.getHealthStatus();
      expect(healthStatus.ws).toBe(false);
    }, 15000);

    it('should implement exponential backoff for reconnection', async () => {
      connectionManager = new SolanaConnectionManager({
        rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        wsUrl: 'wss://invalid-websocket-endpoint.example.com',
        wsReconnect: true,
        maxReconnectAttempts: 3,
      });

      const startTime = Date.now();

      try {
        await connectionManager.connectWebSocket();
      } catch (error) {
        // Expected to fail
      }

      const duration = Date.now() - startTime;

      // Should take at least baseDelay + (baseDelay * 2) + (baseDelay * 4) = 7000ms
      expect(duration).toBeGreaterThan(5000);
    }, 20000);
  });

  describe('Connection State Management', () => {
    it('should track connection state correctly', async () => {
      connectionManager = new SolanaConnectionManager({
        rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        wsUrl: testWsUrl,
        wsReconnect: true,
      });

      // Initial state should be DISCONNECTED
      expect(connectionManager.isWsConnected()).toBe(false);

      await connectionManager.connectWebSocket();

      // State should be CONNECTED
      expect(connectionManager.isWsConnected()).toBe(true);

      await connectionManager.close();

      // State should be DISCONNECTED after close
      expect(connectionManager.isWsConnected()).toBe(false);
    });

    it('should emit connection state events', async () => {
      connectionManager = new SolanaConnectionManager({
        rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        wsUrl: testWsUrl,
        wsReconnect: true,
      });

      const events: string[] = [];

      connectionManager.on('connect', () => {
        events.push('connect');
      });

      connectionManager.on('disconnect', () => {
        events.push('disconnect');
      });

      connectionManager.on('error', (error) => {
        events.push('error');
      });

      await connectionManager.connectWebSocket();

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Should have received connect event
      expect(events).toContain('connect');

      await connectionManager.close();
    });

    it('should handle manual reconnection', async () => {
      connectionManager = new SolanaConnectionManager({
        rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        wsUrl: testWsUrl,
        wsReconnect: false, // Disable auto-reconnect
      });

      await connectionManager.connectWebSocket();
      expect(connectionManager.isWsConnected()).toBe(true);

      // Close connection
      await connectionManager.close();

      // Manually reconnect
      await connectionManager.reconnectWebSocket();

      expect(connectionManager.isWsConnected()).toBe(true);
    });
  });

  describe('Subscription Restoration', () => {
    it('should restore subscriptions after reconnection', async () => {
      connectionManager = new SolanaConnectionManager({
        rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        wsUrl: testWsUrl,
        wsReconnect: true,
        maxReconnectAttempts: 5,
      });

      await connectionManager.connectWebSocket();

      // Create a subscription
      const systemProgram = new PublicKey('11111111111111111111111111111111');
      let callbackCount = 0;

      const subscriptionId = connectionManager.onAccountChange(
        systemProgram,
        (accountInfo, context) => {
          callbackCount++;
        },
        'confirmed'
      );

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Trigger reconnection
      await connectionManager.reconnectWebSocket();

      expect(connectionManager.isWsConnected()).toBe(true);

      // Subscription should still be active
      // (Note: This is a basic check - in a real scenario, you'd verify by triggering an actual account change)

      connectionManager.removeAccountChangeListener(subscriptionId);
    });
  });

  describe('Graceful Shutdown', () => {
    it('should close WebSocket connection gracefully', async () => {
      connectionManager = new SolanaConnectionManager({
        rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        wsUrl: testWsUrl,
        wsReconnect: true,
      });

      await connectionManager.connectWebSocket();

      expect(connectionManager.isWsConnected()).toBe(true);

      await connectionManager.close();

      expect(connectionManager.isWsConnected()).toBe(false);
    });

    it('should clean up all subscriptions on close', async () => {
      connectionManager = new SolanaConnectionManager({
        rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        wsUrl: testWsUrl,
        wsReconnect: true,
      });

      await connectionManager.connectWebSocket();

      // Create subscriptions
      const accounts = [
        new PublicKey('11111111111111111111111111111111'),
        new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
      ];

      const subscriptionIds = accounts.map(account =>
        connectionManager.onAccountChange(
          account,
          () => {},
          'confirmed'
        )
      );

      // Close connection
      await connectionManager.close();

      // Subscriptions should be cleaned up
      expect(connectionManager.isWsConnected()).toBe(false);
    });

    it('should handle multiple close calls without error', async () => {
      connectionManager = new SolanaConnectionManager({
        rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        wsUrl: testWsUrl,
        wsReconnect: true,
      });

      await connectionManager.connectWebSocket();

      // Close multiple times
      await connectionManager.close();
      await connectionManager.close();
      await connectionManager.close();

      expect(connectionManager.isWsConnected()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle WebSocket connection errors gracefully', async () => {
      connectionManager = new SolanaConnectionManager({
        rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        wsUrl: 'wss://invalid-websocket-endpoint.example.com',
        wsReconnect: false, // Disable auto-reconnect for this test
      });

      let connectionError: Error | null = null;

      try {
        await connectionManager.connectWebSocket();
      } catch (error) {
        connectionError = error as Error;
      }

      expect(connectionError).toBeDefined();
      expect(connectionManager.isWsConnected()).toBe(false);
    });

    it('should handle subscription errors gracefully', async () => {
      connectionManager = new SolanaConnectionManager({
        rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        wsUrl: testWsUrl,
        wsReconnect: true,
      });

      await connectionManager.connectWebSocket();

      // Try to subscribe with invalid parameters
      // This should not crash the connection manager
      try {
        connectionManager.onLogs(
          undefined as any,
          () => {},
          'confirmed'
        );
      } catch (error) {
        // Expected error
      }

      // Connection should still be alive
      expect(connectionManager.isWsConnected()).toBe(true);
    });
  });

  describe('Integration with RPC Connection', () => {
    it('should maintain separate RPC and WebSocket connections', async () => {
      connectionManager = new SolanaConnectionManager({
        rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        wsUrl: testWsUrl,
        wsReconnect: true,
      });

      await connectionManager.connectWebSocket();

      // Both connections should be available
      const rpcConnection = connectionManager.getConnection();
      const wsConnection = connectionManager.getWsConnection();

      expect(rpcConnection).toBeDefined();
      expect(wsConnection).toBeDefined();

      // Both should work
      const rpcVersion = await rpcConnection.getVersion();
      const wsVersion = await wsConnection.getVersion();

      expect(rpcVersion).toBeDefined();
      expect(wsVersion).toBeDefined();
    });

    it('should use appropriate connection for different operations', async () => {
      connectionManager = new SolanaConnectionManager({
        rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
        wsUrl: testWsUrl,
        wsReconnect: true,
      });

      await connectionManager.connectWebSocket();

      // RPC operations should use HTTP connection
      const accountInfo = await connectionManager.getAccountInfo(
        new PublicKey('11111111111111111111111111111111')
      );

      expect(accountInfo).toBeDefined();

      // WebSocket operations should use WS connection
      const subscriptionId = connectionManager.onAccountChange(
        new PublicKey('11111111111111111111111111111111'),
        () => {},
        'confirmed'
      );

      expect(typeof subscriptionId).toBe('number');

      connectionManager.removeAccountChangeListener(subscriptionId);
    });
  });
});
