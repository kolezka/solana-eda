import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';
import { OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import type { AnyEvent } from '@solana-eda/events';

/**
 * WebSocket Gateway for real-time event delivery
 * Uses EventEmitter2 to receive events from RabbitMQ consumers
 */
@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  server: Server | null = null;

  private readonly logger = new Logger(EventsGateway.name);
  private subscribers: Map<Socket, Set<string>> = new Map();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  onModuleInit(): void {
    this.logger.log('EventsGateway initialized with EventEmitter2');

    // Subscribe to all event types from EventEmitter2
    const eventTypes = [
      'BURN_DETECTED',
      'LIQUIDITY_CHANGED',
      'TRADE_EXECUTED',
      'POSITION_OPENED',
      'POSITION_CLOSED',
      'WORKER_STATUS',
      'PRICE_UPDATE',
    ];

    // Register event listeners for each type
    eventTypes.forEach(eventType => {
      this.eventEmitter.on(eventType, (event: AnyEvent) => {
        this.broadcastEvent(eventType, event);
      });
    });

    this.logger.log(`Registered listeners for ${eventTypes.length} event types`);
  }

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
    this.subscribers.set(client, new Set());

    // Send welcome message
    client.emit('connected', {
      message: 'Connected to Solana EDA events',
      timestamp: new Date().toISOString(),
    });
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
    this.subscribers.delete(client);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, channel: string): void {
    this.logger.log(`Client ${client.id} subscribed to: ${channel}`);
    const channels = this.subscribers.get(client) || new Set();
    channels.add(channel);
    this.subscribers.set(client, channels);

    client.emit('subscribed', { channel, timestamp: new Date().toISOString() });
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(client: Socket, channel: string): void {
    this.logger.log(`Client ${client.id} unsubscribed from: ${channel}`);
    const channels = this.subscribers.get(client);
    if (channels) {
      channels.delete(channel);
    }

    client.emit('unsubscribed', { channel, timestamp: new Date().toISOString() });
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket): void {
    client.emit('pong', { timestamp: new Date().toISOString() });
  }

  /**
   * Broadcast event to all subscribed clients
   */
  private broadcastEvent(eventType: string, event: AnyEvent): void {
    if (!this.server) {
      return;
    }

    // Send to all clients (WebSocket broadcasts don't filter by subscription)
    // Clients can filter on the frontend if needed
    this.server.emit('event', {
      type: eventType,
      data: event,
      timestamp: new Date().toISOString(),
    });

    this.logger.debug(`Broadcasted ${eventType} event to clients`);
  }

  /**
   * Get current subscriber count
   */
  getSubscriberCount(): number {
    return this.subscribers.size;
  }

  /**
   * Get subscriptions for a client
   */
  getClientSubscriptions(clientId: string): string[] {
    for (const [client, channels] of this.subscribers.entries()) {
      if (client.id === clientId) {
        return Array.from(channels);
      }
    }
    return [];
  }
}
