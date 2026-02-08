import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import { validateEvent, CHANNELS } from '@solana-eda/events';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit {
  @WebSocketServer()
  server!: Server;

  private subscribers: Map<Socket, Set<string>> = new Map();
  private redisSubscriber: Redis | null = null;

  constructor(@Inject('REDIS') private redis: Redis) {
    // Don't call subscribeToRedisChannels in constructor
  }

  onModuleInit() {
    console.log('EventsGateway initialized');
    // Temporarily disable Redis subscription to test if it's blocking startup
    // this.subscribeToRedisChannels().catch(err => {
    //   console.error('Failed to subscribe to Redis channels:', err);
    // });
  }

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
    this.subscribers.set(client, new Set());
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    this.subscribers.delete(client);
  }

  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, channel: string) {
    console.log(`Client ${client.id} subscribed to: ${channel}`);
    const channels = this.subscribers.get(client) || new Set();
    channels.add(channel);
    this.subscribers.set(client, channels);

    client.emit('subscribed', { channel });
  }

  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(client: Socket, channel: string) {
    console.log(`Client ${client.id} unsubscribed from: ${channel}`);
    const channels = this.subscribers.get(client);
    if (channels) {
      channels.delete(channel);
    }

    client.emit('unsubscribed', { channel });
  }

  private async subscribeToRedisChannels() {
    // Create a dedicated subscriber client
    this.redisSubscriber = this.redis.duplicate();

    // Wait for connection without blocking indefinitely
    try {
      await Promise.race([
        this.redisSubscriber.connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Redis connect timeout')), 5000),
        ),
      ]);
    } catch (err) {
      console.error('Redis subscriber connection failed or timed out:', err);
      return;
    }

    const channels = [
      CHANNELS.EVENTS_BURN,
      CHANNELS.EVENTS_LIQUIDITY,
      CHANNELS.EVENTS_TRADES,
      CHANNELS.EVENTS_POSITIONS,
      CHANNELS.EVENTS_PRICE,
      CHANNELS.WORKERS_STATUS,
    ];

    for (const channel of channels) {
      await this.redisSubscriber.subscribe(channel);
    }

    this.redisSubscriber.on('message', (channel, message) => {
      try {
        const event = validateEvent(JSON.parse(message));
        this.broadcastEvent(channel, event);
      } catch (error) {
        console.error(`Error parsing event:`, error);
      }
    });
  }

  private broadcastEvent(channel: string, event: any) {
    this.server.emit('event', { channel, data: event });
  }
}
