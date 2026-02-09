/**
 * Sidecar Connection Client
 *
 * Client library for workers to connect to the RPC Sidecar service.
 * Provides a drop-in replacement for SolanaConnectionManager.
 */

import { Socket } from 'net';
import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import type { AccountInfo, Context } from '@solana/web3.js';
import type { CommitmentLevel } from './connection';

export interface SidecarConnectionConfig {
  socketPath?: string;
  wsUrl?: string;
  timeout?: number;
}

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
  type: 'subscribe' | 'unsubscribe' | 'subscribed' | 'unsubscribed' | 'error' | 'event';
  channel?: string;
  data?: unknown;
  message?: string;
  params?: Record<string, unknown>; // Add params field for subscribe messages
}

/**
 * Sidecar Connection Client
 * Connects to RPC Sidecar via IPC and WebSocket
 */
export class SidecarConnection extends EventEmitter {
  private ipcClient: Socket | null = null;
  private wsClient: WebSocket | null = null;
  private socketPath: string;
  private wsUrl: string;
  private timeout: number;
  private connected: boolean = false;
  private requestId = 0;
  private pendingRequests: Map<string, {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }> = new Map();

  private subscriptions: Set<string> = new Set();

  constructor(config: SidecarConnectionConfig = {}) {
    super();

    this.socketPath = config.socketPath || process.env.RPC_SIDECAR_SOCKET || '/tmp/solana-rpc.sock';
    this.wsUrl = config.wsUrl || process.env.RPC_SIDECAR_WS_URL || 'ws://localhost:3002';
    this.timeout = config.timeout || 10000;

    console.log(`[SidecarClient] Initializing with socket=${this.socketPath}, ws=${this.wsUrl}`);
  }

  /**
   * Connect to the sidecar service
   */
  async connect(): Promise<void> {
    if (this.connected) {
      return;
    }

    await Promise.all([
      this.connectIPC(),
      this.connectWebSocket(),
    ]);

    this.connected = true;
    console.log('[SidecarClient] Connected');
  }

  /**
   * Connect via IPC
   */
  private async connectIPC(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ipcClient = new Socket();

      let buffer = '';

      this.ipcClient.on('connect', () => {
        console.log('[SidecarClient] IPC connected');
        resolve();
      });

      this.ipcClient.on('data', (data: Buffer) => {
        buffer += data.toString();

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          try {
            const response: IPCResponse = JSON.parse(line);
            this.handleIPCResponse(response);
          } catch (error) {
            console.error('[SidecarClient] IPC response parse error:', error);
          }
        }
      });

      this.ipcClient.on('error', (error) => {
        console.error('[SidecarClient] IPC error:', error);
        reject(error);
      });

      this.ipcClient.connect(this.socketPath);
    });
  }

  /**
   * Connect via WebSocket
   */
  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wsClient = new WebSocket(this.wsUrl);

      this.wsClient.on('open', () => {
        console.log('[SidecarClient] WebSocket connected');
        resolve();
      });

      this.wsClient.on('error', (error: Error) => {
        console.error('[SidecarClient] WebSocket error:', error);
        reject(error);
      });

      this.wsClient.on('message', (data: Buffer) => {
        try {
          const message: SubscriptionMessage = JSON.parse(data.toString());
          this.handleWSMessage(message);
        } catch (error) {
          console.error('[SidecarClient] WebSocket message parse error:', error);
        }
      });

      this.wsClient.on('close', () => {
        console.warn('[SidecarClient] WebSocket disconnected');
        this.connected = false;
        this.emit('disconnect');
      });
    });
  }

  /**
   * Handle IPC response
   */
  private handleIPCResponse(response: IPCResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timer);
    this.pendingRequests.delete(response.id);

    if (response.error) {
      pending.reject(new Error(response.error));
    } else {
      pending.resolve(response.result);
    }
  }

  /**
   * Handle WebSocket message
   */
  private handleWSMessage(message: SubscriptionMessage): void {
    if (message.type === 'event' && message.channel) {
      this.emit(message.channel, message.data);
    } else if (message.type === 'error') {
      this.emit('error', new Error(message.message));
    }
  }

  /**
   * Make IPC request
   */
  private async ipcRequest(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
    if (!this.ipcClient) {
      throw new Error('IPC client not connected');
    }

    const id = `req_${++this.requestId}_${Date.now()}`;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, this.timeout);

      this.pendingRequests.set(id, { resolve, reject, timer });

      const request: IPCRequest = { id, method, params };
      this.ipcClient!.write(JSON.stringify(request) + '\n');
    });
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get connection health status
   */
  async getHealthStatus(): Promise<{
    sidecar: unknown;
    solana: unknown;
  }> {
    return await this.ipcRequest('getHealthStatus') as {
      sidecar: unknown;
      solana: unknown;
    };
  }

  /**
   * Ping the sidecar
   */
  async ping(): Promise<{ pong: boolean; timestamp: number }> {
    return await this.ipcRequest('ping') as { pong: boolean; timestamp: number };
  }

  /**
   * Get account info
   */
  async getAccountInfo(publicKey: { toBase58: () => string } | string): Promise<AccountInfo<Buffer> | null> {
    const publicKeyStr = typeof publicKey === 'string' ? publicKey : publicKey.toBase58();
    return await this.ipcRequest('getAccountInfo', { publicKey: publicKeyStr }) as AccountInfo<Buffer> | null;
  }

  /**
   * Get transaction
   */
  async getTransaction(signature: string): Promise<unknown> {
    return await this.ipcRequest('getTransaction', { signature });
  }

  /**
   * Get multiple accounts
   */
  async getMultipleAccounts(publicKeys: Array<{ toBase58: () => string } | string>): Promise<(AccountInfo<Buffer> | null)[]> {
    const publicKeyStrs = publicKeys.map(k => typeof k === 'string' ? k : k.toBase58());
    return await this.ipcRequest('getMultipleAccounts', { publicKeys: publicKeyStrs }) as (AccountInfo<Buffer> | null)[];
  }

  /**
   * Get latest blockhash
   */
  async getLatestBlockhash(): Promise<{ blockhash: string }> {
    return await this.ipcRequest('getLatestBlockhash') as { blockhash: string };
  }

  /**
   * Get balance
   */
  async getBalance(publicKey: { toBase58: () => string } | string): Promise<number> {
    const publicKeyStr = typeof publicKey === 'string' ? publicKey : publicKey.toBase58();
    return await this.ipcRequest('getBalance', { publicKey: publicKeyStr }) as number;
  }

  /**
   * Send raw transaction
   */
  async sendRawTransaction(
    transaction: Buffer,
    options?: { skipPreflight?: boolean; maxRetries?: number }
  ): Promise<string> {
    return await this.ipcRequest('sendRawTransaction', {
      transaction: transaction.toString('base64'),
      options,
    }) as string;
  }

  /**
   * Send transaction - for compatibility with Connection interface
   * This is used by DEX clients like JupiterClient
   */
  async sendTransaction(
    transaction: { serialize?: () => Buffer; version?: unknown },
    options?: { skipPreflight?: boolean; maxRetries?: number }
  ): Promise<string> {
    let txBuffer: Buffer;

    // Handle both legacy Transaction and VersionedTransaction
    if (transaction.serialize && typeof transaction.serialize === 'function') {
      txBuffer = transaction.serialize();
    } else {
      // VersionedTransaction - needs different handling
      throw new Error('VersionedTransaction not supported via sidecar yet');
    }

    return await this.sendRawTransaction(txBuffer, options);
  }

  /**
   * Confirm transaction
   */
  async confirmTransaction(signature: string, commitment?: CommitmentLevel): Promise<unknown> {
    return await this.ipcRequest('confirmTransaction', { signature, commitment });
  }

  /**
   * Get token account balance
   */
  async getTokenAccountBalance(
    tokenAccount: { toBase58: () => string } | string
  ): Promise<{ amount: string; decimals: number; uiAmount: number }> {
    const tokenAccountStr = typeof tokenAccount === 'string' ? tokenAccount : tokenAccount.toBase58();
    return await this.ipcRequest('getTokenAccountBalance', {
      tokenAccount: tokenAccountStr,
    }) as { amount: string; decimals: number; uiAmount: number };
  }

  /**
   * Subscribe to logs
   */
  async onLogs(
    filter: unknown,
    callback: (logs: any, context: any) => void,
    commitment?: CommitmentLevel
  ): Promise<number> {
    const channel = `logs:${filter}`;
    await this.subscribe(channel, { filter, commitment });
    this.on(channel, callback);
    return this.subscriptions.size + 1000; // Return a fake subscription ID
  }

  /**
   * Remove logs listener
   */
  removeOnLogsListener(subscriptionId: number): void {
    // Find and remove subscription
    for (const channel of this.subscriptions) {
      this.removeAllListeners(channel);
      this.unsubscribe(channel).catch(console.error);
      break;
    }
  }

  /**
   * Subscribe to account changes
   */
  async onAccountChange(
    publicKey: { toBase58: () => string } | string,
    callback: (accountInfo: AccountInfo<Buffer> | null, context: Context) => void,
    commitment?: CommitmentLevel
  ): Promise<number> {
    const publicKeyStr = typeof publicKey === 'string' ? publicKey : publicKey.toBase58();
    const channel = `account:${publicKeyStr}`;
    await this.subscribe(channel, { publicKey: publicKeyStr, commitment });
    this.on(channel, callback);
    return this.subscriptions.size + 2000; // Return a fake subscription ID
  }

  /**
   * Remove account change listener
   */
  removeAccountChangeListener(subscriptionId: number): void {
    for (const channel of this.subscriptions) {
      this.removeAllListeners(channel);
      this.unsubscribe(channel).catch(console.error);
      break;
    }
  }

  /**
   * Subscribe to a channel
   */
  private async subscribe(channel: string, params: Record<string, unknown>): Promise<void> {
    if (!this.wsClient || this.wsClient.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const message: SubscriptionMessage = {
      type: 'subscribe',
      channel,
      params,
    };

    this.wsClient.send(JSON.stringify(message));
    this.subscriptions.add(channel);
  }

  /**
   * Unsubscribe from a channel
   */
  private async unsubscribe(channel: string): Promise<void> {
    if (!this.wsClient || this.wsClient.readyState !== WebSocket.OPEN) {
      return;
    }

    const message: SubscriptionMessage = {
      type: 'unsubscribe',
      channel,
    };

    this.wsClient.send(JSON.stringify(message));
    this.subscriptions.delete(channel);
    this.removeAllListeners(channel);
  }

  /**
   * Close the connection
   */
  async close(): Promise<void> {
    console.log('[SidecarClient] Closing connection...');

    // Close IPC
    if (this.ipcClient) {
      this.ipcClient.end();
      this.ipcClient = null;
    }

    // Close WebSocket
    if (this.wsClient) {
      this.wsClient.close();
      this.wsClient = null;
    }

    // Clear pending requests
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();

    this.connected = false;
    console.log('[SidecarClient] Connection closed');
  }
}

/**
 * Create a sidecar connection from environment variables
 */
export function createSidecarConnection(config?: SidecarConnectionConfig): SidecarConnection {
  return new SidecarConnection(config);
}
