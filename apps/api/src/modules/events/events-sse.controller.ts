import { Controller, Get, Sse, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Observable, fromEvent, map } from 'rxjs';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventEmitter } from 'events';
import type { AnyEvent } from '@solana-eda/events';

/**
 * SSE (Server-Sent Events) Controller for real-time event streaming
 * Provides an alternative to WebSocket for clients that prefer HTTP streaming
 */
@Controller('events/stream')
export class EventsSseController {
  private readonly clients: Map<string, EventEmitter> = new Map();

  constructor(private readonly eventEmitter: EventEmitter2) {
    // Listen to all events and forward to SSE clients
    const eventTypes = [
      'BURN_DETECTED',
      'LIQUIDITY_CHANGED',
      'TRADE_EXECUTED',
      'POSITION_OPENED',
      'POSITION_CLOSED',
      'WORKER_STATUS',
      'PRICE_UPDATE',
    ];

    eventTypes.forEach(eventType => {
      this.eventEmitter.on(eventType, (event: AnyEvent) => {
        this.broadcastToSseClients(eventType, event);
      });
    });
  }

  /**
   * Stream all events via SSE
   * GET /events/stream
   */
  @Sse('')
  streamAll(@Req() req: Request): Observable<MessageEvent> {
    return this.createSseStream(req, 'all');
  }

  /**
   * Stream burn events only
   * GET /events/stream/burns
   */
  @Sse('burns')
  streamBurns(@Req() req: Request): Observable<MessageEvent> {
    return this.createSseStream(req, 'burns');
  }

  /**
   * Stream trade events only
   * GET /events/stream/trades
   */
  @Sse('trades')
  streamTrades(@Req() req: Request): Observable<MessageEvent> {
    return this.createSseStream(req, 'trades');
  }

  /**
   * Stream price events only
   * GET /events/stream/prices
   */
  @Sse('prices')
  streamPrices(@Req() req: Request): Observable<MessageEvent> {
    return this.createSseStream(req, 'prices');
  }

  /**
   * Stream liquidity events only
   * GET /events/stream/liquidity
   */
  @Sse('liquidity')
  streamLiquidity(@Req() req: Request): Observable<MessageEvent> {
    return this.createSseStream(req, 'liquidity');
  }

  /**
   * Stream position events only
   * GET /events/stream/positions
   */
  @Sse('positions')
  streamPositions(@Req() req: Request): Observable<MessageEvent> {
    return this.createSseStream(req, 'positions');
  }

  /**
   * Stream worker status events only
   * GET /events/stream/workers
   */
  @Sse('workers')
  streamWorkers(@Req() req: Request): Observable<MessageEvent> {
    return this.createSseStream(req, 'workers');
  }

  /**
   * Create SSE stream for a client
   */
  private createSseStream(req: Request, filter: string): Observable<MessageEvent> {
    const clientId = this.generateClientId(req, filter);
    const clientEmitter = new EventEmitter();
    this.clients.set(clientId, clientEmitter);

    // Send initial connection message
    setTimeout(() => {
      clientEmitter.emit('message', {
        data: JSON.stringify({
          type: 'connected',
          filter,
          timestamp: new Date().toISOString(),
          clientId,
        }),
      });
    }, 0);

    // Clean up on client disconnect
    req.on('close', () => {
      this.clients.delete(clientId);
      clientEmitter.removeAllListeners();
    });

    // Convert EventEmitter to Observable
    return fromEvent(clientEmitter, 'message').pipe(
      map((data: any) => data)
    );
  }

  /**
   * Broadcast event to all SSE clients
   */
  private broadcastToSseClients(eventType: string, event: AnyEvent): void {
    const eventData = {
      type: eventType,
      data: event,
      timestamp: new Date().toISOString(),
    };

    for (const [clientId, emitter] of this.clients.entries()) {
      const filter = clientId.split(':')[1];

      // Filter events based on client subscription
      if (filter && this.shouldSendEvent(eventType, filter)) {
        emitter.emit('message', {
          data: JSON.stringify(eventData),
        });
      }
    }
  }

  /**
   * Check if event should be sent to client based on filter
   */
  private shouldSendEvent(eventType: string, filter: string): boolean {
    if (filter === 'all') return true;

    const eventTypeMap: Record<string, string> = {
      BURN_DETECTED: 'burns',
      LIQUIDITY_CHANGED: 'liquidity',
      TRADE_EXECUTED: 'trades',
      POSITION_OPENED: 'positions',
      POSITION_CLOSED: 'positions',
      WORKER_STATUS: 'workers',
      PRICE_UPDATE: 'prices',
    };

    return eventTypeMap[eventType] === filter;
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(req: Request, filter: string): string {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return `${ip}:${filter}:${Date.now()}`;
  }

  /**
   * Get current SSE client count
   */
  @Get('stream/stats')
  getSseStats(): { clientCount: number } {
    return { clientCount: this.clients.size };
  }
}
