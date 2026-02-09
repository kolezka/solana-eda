/**
 * RabbitMQ Connection Manager
 * Handles connection lifecycle, reconnection with exponential backoff
 */

import amqp from 'amqplib';
import type { Channel, Connection } from 'amqplib';
import { type RabbitMQConfig, type ConnectionHealth } from './types';

export class RabbitMQConnection {
  private connection: Connection | null = null;
  private channel: Channel | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private isShuttingDown = false;

  constructor(private config: RabbitMQConfig) {}

  /**
   * Establish connection to RabbitMQ
   */
  async connect(): Promise<void> {
    const { url, maxRetries = 10, reconnectDelay = 5000 } = this.config;

    try {
      console.log(`[RabbitMQ] Connecting to ${this.sanitizeUrl(url)}...`);

      const conn = await amqp.connect(url);
      this.connection = conn as unknown as Connection;

      if (this.connection) {
        this.connection.on('error', (error) => {
          console.error('[RabbitMQ] Connection error:', error instanceof Error ? error.message : String(error));
          if (!this.isShuttingDown) {
            this.scheduleReconnect();
          }
        });

        this.connection.on('close', () => {
          console.warn('[RabbitMQ] Connection closed');
          if (!this.isShuttingDown) {
            this.scheduleReconnect();
          }
        });

        this.channel = await (this.connection as any).createChannel();

        // Enable publisher confirms if configured
        if (this.config.enablePublisherConfirms && this.channel) {
          await (this.channel as any).waitForConfirms();
        }

        this.reconnectAttempts = 0;
        console.log('[RabbitMQ] Connected and channel created');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[RabbitMQ] Connection failed: ${errorMessage}`);

      this.reconnectAttempts++;

      if (maxRetries > 0 && this.reconnectAttempts >= maxRetries) {
        throw new Error(`[RabbitMQ] Max connection attempts (${maxRetries}) reached`);
      }

      this.scheduleReconnect();
      throw error;
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimer || this.isShuttingDown) {
      return;
    }

    const baseDelay = this.config.reconnectDelay || 5000;
    const delay = Math.min(
      baseDelay * Math.pow(2, this.reconnectAttempts),
      30000 // Max 30 seconds
    ) + Math.random() * 1000; // Add jitter

    console.log(`[RabbitMQ] Scheduling reconnect in ${Math.round(delay / 1000)}s (attempt ${this.reconnectAttempts + 1})`);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
        // Re-establish topology and consumers after reconnect
        this.emit('reconnected');
      } catch (error) {
        // Reconnect failed, scheduleRetry will be called by connect()
      }
    }, delay);
  }

  /**
   * Get the AMQP channel
   */
  getChannel(): Channel {
    if (!this.channel) {
      throw new Error('[RabbitMQ] Channel not available. Call connect() first.');
    }
    return this.channel;
  }

  /**
   * Get the connection
   */
  getConnection(): Connection {
    if (!this.connection) {
      throw new Error('[RabbitMQ] Connection not available. Call connect() first.');
    }
    return this.connection;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connection !== null && this.channel !== null;
  }

  /**
   * Get connection health status
   */
  getHealth(): ConnectionHealth {
    return {
      connected: this.isConnected(),
      url: this.sanitizeUrl(this.config.url),
      attempt: this.reconnectAttempts,
      lastError: undefined, // TODO: Track last error
      connectedAt: undefined, // TODO: Track connection timestamp
    };
  }

  /**
   * Close connection gracefully
   */
  async close(): Promise<void> {
    this.isShuttingDown = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    try {
      if (this.channel) {
        await (this.channel as any).close();
        this.channel = null;
      }

      if (this.connection) {
        await (this.connection as any).close();
        this.connection = null;
      }

      console.log('[RabbitMQ] Connection closed gracefully');
    } catch (error) {
      console.error('[RabbitMQ] Error during close:', error);
    }
  }

  /**
   * Sanitize URL for logging (remove password)
   */
  private sanitizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      if (parsed.password) {
        return url.replace(/:[^:@]+@/, ':****@');
      }
      return url;
    } catch {
      return url.replace(/:[^:@]+@/, ':****@');
    }
  }

  /**
   * Simple event emitter for reconnection events
   * In production, consider using EventEmitter2
   */
  private listeners: Record<string, Array<() => void>> = {};

  on(event: 'reconnected', callback: () => void): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  private emit(event: 'reconnected'): void {
    const callbacks = this.listeners[event] || [];
    callbacks.forEach(cb => cb());
  }
}
