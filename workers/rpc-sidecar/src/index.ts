/**
 * RPC Sidecar Service
 *
 * Provides a single shared connection to Solana RPC for all workers.
 * Workers connect via IPC (Unix socket) for RPC calls and WebSocket for subscriptions.
 *
 * Benefits:
 * - Single connection to RPC provider (avoids rate limiting issues)
 * - Centralized connection pooling with health checking
 * - Fast IPC communication for HTTP RPC calls
 * - WebSocket event forwarding to multiple subscribers
 */

import { createServer, Server as NetServer, Socket } from 'net';
import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { SolanaConnectionManager, createRpcPoolFromEnv } from '@solana-eda/solana-client';
import { PublicKey } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

// Configuration
const SOCKET_PATH = process.env.RPC_SIDECAR_SOCKET || '/tmp/solana-rpc.sock';
const WS_PORT = parseInt(process.env.RPC_SIDECAR_WS_PORT || '3002', 10);
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const SOLANA_WS_URL = process.env.SOLANA_WS_URL;

interface IPCRequest {
  id: string;
  method: string;
  params: Record<string, unknown>;
}

interface IPCResponse {
  id: string;
  result?: unknown;
  error?: string;
}

interface SubscriptionMessage {
  type: 'subscribe' | 'unsubscribe';
  channel: string;
  params: Record<string, unknown>;
}

interface SubscriptionEvent {
  channel: string;
  data: unknown;
}

/**
 * RPC Sidecar Service
 */
class RPCSidecar extends EventEmitter {
  private connection: SolanaConnectionManager;
  private ipcServer: NetServer;
  private wsServer: WebSocketServer;
  private subscriptions: Map<string, Set<WebSocket>> = new Map();
  private rpcSubscriptions: Map<string, number> = new Map();

  private metrics = {
    ipcRequests: 0,
    ipcErrors: 0,
    wsConnections: 0,
    activeSubscriptions: 0,
    startTime: Date.now(),
  };

  constructor() {
    super();

    console.log('[RPCSidecar] Initializing...');
    console.log(`[RPCSidecar] RPC URL: ${SOLANA_RPC_URL}`);
    console.log(`[RPCSidecar] IPC Socket: ${SOCKET_PATH}`);
    console.log(`[RPCSidecar] WebSocket Port: ${WS_PORT}`);

    // Initialize Solana connection with pooling enabled
    this.connection = new SolanaConnectionManager({
      rpcUrl: SOLANA_RPC_URL,
      wsUrl: SOLANA_WS_URL,
      usePool: true,
    });

    // Create IPC server
    this.ipcServer = createServer();
    this.ipcServer.on('connection', this.handleIPCConnection.bind(this));

    // Create WebSocket server
    this.wsServer = new WebSocketServer({ port: WS_PORT });
    this.wsServer.on('connection', this.handleWSConnection.bind(this));

    // Log connection status
    this.logConnectionStatus();
  }

  /**
   * Start the sidecar service
   */
  async start(): Promise<void> {
    // Clean up socket file if exists
    if (fs.existsSync(SOCKET_PATH)) {
      fs.unlinkSync(SOCKET_PATH);
    }

    // Ensure directory exists
    const socketDir = path.dirname(SOCKET_PATH);
    if (!fs.existsSync(socketDir)) {
      fs.mkdirSync(socketDir, { recursive: true });
    }

    // Start IPC server
    await new Promise<void>((resolve) => {
      this.ipcServer.listen(SOCKET_PATH, () => {
        console.log(`[RPCSidecar] IPC server listening on ${SOCKET_PATH}`);
        resolve();
      });
    });

    // Log WebSocket server status
    console.log(`[RPCSidecar] WebSocket server listening on port ${WS_PORT}`);

    // Set up shutdown handlers
    this.setupShutdownHandlers();

    console.log('[RPCSidecar] Started successfully');
    this.emit('started');
  }

  /**
   * Stop the sidecar service
   */
  async stop(): Promise<void> {
    console.log('[RPCSidecar] Stopping...');

    // Close WebSocket server
    this.wsServer.close();
    console.log('[RPCSidecar] WebSocket server closed');

    // Close IPC server
    this.ipcServer.close();
    console.log('[RPCSidecar] IPC server closed');

    // Clean up socket file
    if (fs.existsSync(SOCKET_PATH)) {
      fs.unlinkSync(SOCKET_PATH);
    }

    // Close Solana connection
    await this.connection.close();
    console.log('[RPCSidecar] Solana connection closed');

    console.log('[RPCSidecar] Stopped');
    this.emit('stopped');
  }

  /**
   * Handle IPC connection from worker
   */
  private handleIPCConnection(socket: Socket): void {
    console.log('[RPCSidecar] Worker connected via IPC');

    let buffer = '';

    socket.on('data', async (data: Buffer) => {
      buffer += data.toString();

      // Process complete messages (newline-separated)
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const request: IPCRequest = JSON.parse(line);
          await this.handleIPCRequest(socket, request);
        } catch (error) {
          console.error('[RPCSidecar] IPC request error:', error);
          this.sendIPCError(socket, 'parse_error', error instanceof Error ? error.message : String(error));
        }
      }
    });

    socket.on('error', (error) => {
      console.error('[RPCSidecar] IPC socket error:', error);
      this.metrics.ipcErrors++;
    });

    socket.on('close', () => {
      console.log('[RPCSidecar] Worker disconnected via IPC');
    });
  }

  /**
   * Handle IPC request
   */
  private async handleIPCRequest(socket: Socket, request: IPCRequest): Promise<void> {
    this.metrics.ipcRequests++;

    const response: IPCResponse = {
      id: request.id,
    };

    try {
      switch (request.method) {
        case 'ping':
          response.result = { pong: true, timestamp: Date.now() };
          break;

        case 'getAccountInfo':
          response.result = await this.connection.getAccountInfo(
            new PublicKey(request.params.publicKey as string)
          );
          break;

        case 'getTransaction':
          response.result = await this.connection.getTransaction(
            request.params.signature as string
          );
          break;

        case 'getMultipleAccounts':
          response.result = await this.connection.getMultipleAccounts(
            (request.params.publicKeys as string[]).map(k => new PublicKey(k))
          );
          break;

        case 'getLatestBlockhash':
          response.result = await this.connection.getLatestBlockhash();
          break;

        case 'getBalance':
          response.result = await this.connection.getBalance(
            new PublicKey(request.params.publicKey as string)
          );
          break;

        case 'sendRawTransaction':
          response.result = await this.connection.sendRawTransaction(
            Buffer.from(request.params.transaction as string, 'base64'),
            request.params.options as { skipPreflight?: boolean; maxRetries?: number } | undefined
          );
          break;

        case 'confirmTransaction':
          response.result = await this.connection.confirmTransaction(
            request.params.signature as string,
            request.params.commitment as 'processed' | 'confirmed' | 'finalized' | undefined
          );
          break;

        case 'getTokenAccountBalance':
          response.result = await this.connection.getTokenAccountBalance(
            new PublicKey(request.params.tokenAccount as string)
          );
          break;

        case 'getHealthStatus':
          const healthStatus = await this.connection.getHealthStatus();
          response.result = {
            sidecar: {
              uptime: Date.now() - this.metrics.startTime,
              ipcRequests: this.metrics.ipcRequests,
              ipcErrors: this.metrics.ipcErrors,
              wsConnections: this.metrics.wsConnections,
              activeSubscriptions: this.metrics.activeSubscriptions,
            },
            solana: healthStatus,
          };
          break;

        default:
          response.error = `Unknown method: ${request.method}`;
      }
    } catch (error) {
      response.error = error instanceof Error ? error.message : String(error);
      this.metrics.ipcErrors++;
    }

    socket.write(JSON.stringify(response) + '\n');
  }

  /**
   * Send error response via IPC
   */
  private sendIPCError(socket: Socket, id: string, error: string): void {
    const response: IPCResponse = { id, error };
    socket.write(JSON.stringify(response) + '\n');
  }

  /**
   * Handle WebSocket connection from worker
   */
  private handleWSConnection(ws: WebSocket): void {
    console.log('[RPCSidecar] Worker connected via WebSocket');
    this.metrics.wsConnections++;

    ws.on('error', (error) => {
      console.error('[RPCSidecar] WebSocket error:', error);
    });

    ws.on('close', () => {
      console.log('[RPCSidecar] Worker disconnected via WebSocket');
      this.metrics.wsConnections--;

      // Remove from all subscriptions
      for (const [channel, subscribers] of this.subscriptions.entries()) {
        subscribers.delete(ws);
        if (subscribers.size === 0) {
          this.subscriptions.delete(channel);
          this.cancelSolanaSubscription(channel);
        }
      }

      this.metrics.activeSubscriptions = this.subscriptions.size;
    });

    ws.on('message', async (data: Buffer) => {
      try {
        const message: SubscriptionMessage = JSON.parse(data.toString());
        await this.handleSubscriptionMessage(ws, message);
      } catch (error) {
        console.error('[RPCSidecar] WebSocket message error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : String(error),
        }));
      }
    });
  }

  /**
   * Handle subscription message from worker
   */
  private async handleSubscriptionMessage(
    ws: WebSocket,
    message: SubscriptionMessage
  ): Promise<void> {
    const { type, channel } = message;

    if (type === 'subscribe') {
      await this.handleSubscribe(ws, channel, message.params);
    } else if (type === 'unsubscribe') {
      await this.handleUnsubscribe(ws, channel);
    }
  }

  /**
   * Handle subscription request
   */
  private async handleSubscribe(
    ws: WebSocket,
    channel: string,
    params: Record<string, unknown>
  ): Promise<void> {
    console.log(`[RPCSidecar] Subscribe request: ${channel}`);

    // Add to subscribers
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
      await this.createSolanaSubscription(channel, params);
    }

    this.subscriptions.get(channel)!.add(ws);
    this.metrics.activeSubscriptions = this.subscriptions.size;

    ws.send(JSON.stringify({
      type: 'subscribed',
      channel,
    }));
  }

  /**
   * Handle unsubscribe request
   */
  private async handleUnsubscribe(ws: WebSocket, channel: string): Promise<void> {
    console.log(`[RPCSidecar] Unsubscribe request: ${channel}`);

    const subscribers = this.subscriptions.get(channel);
    if (subscribers) {
      subscribers.delete(ws);

      if (subscribers.size === 0) {
        this.subscriptions.delete(channel);
        await this.cancelSolanaSubscription(channel);
      }
    }

    this.metrics.activeSubscriptions = this.subscriptions.size;

    ws.send(JSON.stringify({
      type: 'unsubscribed',
      channel,
    }));
  }

  /**
   * Create Solana subscription
   */
  private async createSolanaSubscription(
    channel: string,
    params: Record<string, unknown>
  ): Promise<void> {
    const wsConn = this.connection.getWsConnection();
    if (!wsConn) {
      throw new Error('WebSocket connection not available');
    }

    console.log(`[RPCSidecar] Creating Solana subscription: ${channel}`);

    if (channel.startsWith('logs:')) {
      const pubkey = new PublicKey(channel.substring(5));
      const subscriptionId = wsConn.onLogs(pubkey, (logs, ctx) => {
        this.broadcastToSubscribers(channel, { logs, context: ctx });
      });
      this.rpcSubscriptions.set(channel, subscriptionId);
    } else if (channel.startsWith('account:')) {
      const pubkey = new PublicKey(channel.substring(8));
      const subscriptionId = wsConn.onAccountChange(pubkey, (accountInfo, ctx) => {
        this.broadcastToSubscribers(channel, { accountInfo, context: ctx });
      });
      this.rpcSubscriptions.set(channel, subscriptionId);
    } else {
      console.warn(`[RPCSidecar] Unknown subscription type: ${channel}`);
    }
  }

  /**
   * Cancel Solana subscription
   */
  private cancelSolanaSubscription(channel: string): void {
    const subscriptionId = this.rpcSubscriptions.get(channel);
    if (subscriptionId === undefined) {
      return;
    }

    console.log(`[RPCSidecar] Canceling Solana subscription: ${channel}`);

    const wsConn = this.connection.getWsConnection() || this.connection.getConnection();

    if (channel.startsWith('logs:')) {
      wsConn.removeOnLogsListener(subscriptionId);
    } else if (channel.startsWith('account:')) {
      wsConn.removeAccountChangeListener(subscriptionId);
    }

    this.rpcSubscriptions.delete(channel);
  }

  /**
   * Broadcast event to all subscribers of a channel
   */
  private broadcastToSubscribers(channel: string, data: unknown): void {
    const subscribers = this.subscriptions.get(channel);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    const event: SubscriptionEvent = {
      channel,
      data,
    };

    const message = JSON.stringify(event);

    for (const ws of subscribers) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    }
  }

  /**
   * Log connection status
   */
  private logConnectionStatus(): void {
    setInterval(() => {
      const poolStats = this.connection.getPoolStats();
      console.log('[RPCSidecar] Status:', {
        uptime: Math.floor((Date.now() - this.metrics.startTime) / 1000) + 's',
        ipcRequests: this.metrics.ipcRequests,
        ipcErrors: this.metrics.ipcErrors,
        wsConnections: this.metrics.wsConnections,
        activeSubscriptions: this.metrics.activeSubscriptions,
        poolingEnabled: this.connection.isPoolingEnabled(),
      });
    }, 60000); // Every minute
  }

  /**
   * Set up shutdown handlers
   */
  private setupShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      console.log(`[RPCSidecar] Received ${signal}, shutting down...`);
      await this.stop();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    process.on('uncaughtException', (error) => {
      console.error('[RPCSidecar] Uncaught exception:', error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('[RPCSidecar] Unhandled rejection at:', promise, 'reason:', reason);
    });
  }
}

// Main execution
async function main() {
  const sidecar = new RPCSidecar();

  await sidecar.start();

  console.log('[RPCSidecar] Ready to serve requests');
}

main().catch((error) => {
  console.error('[RPCSidecar] Fatal error:', error);
  process.exit(1);
});
