'use client';

import { useState } from 'react';
import { Flame, TrendingUp, DollarSign, Activity, Clock } from 'lucide-react';
import { formatTimestamp, formatNumber } from '@/lib/utils';

interface Event {
  type: string;
  data: any;
  timestamp: string;
  id: string;
}

interface EventFeedProps {
  events: Event[];
}

export default function EventFeed({ events }: EventFeedProps) {
  const [filter, setFilter] = useState<string>('all');

  const filteredEvents = events.filter((event) => {
    if (filter === 'all') return true;
    return event.type.toLowerCase().includes(filter.toLowerCase());
  });

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'BURN_DETECTED':
        return <Flame className="h-4 w-4 text-orange-500" />;
      case 'LIQUIDITY_CHANGED':
        return <TrendingUp className="h-4 w-4 text-blue-500" />;
      case 'TRADE_EXECUTED':
        return <DollarSign className="h-4 w-4 text-green-500" />;
      case 'POSITION_OPENED':
        return <Activity className="h-4 w-4 text-purple-500" />;
      case 'POSITION_CLOSED':
        return <Activity className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'BURN_DETECTED':
        return 'bg-orange-500/10 border-orange-500/20';
      case 'LIQUIDITY_CHANGED':
        return 'bg-blue-500/10 border-blue-500/20';
      case 'TRADE_EXECUTED':
        return 'bg-green-500/10 border-green-500/20';
      case 'POSITION_OPENED':
        return 'bg-purple-500/10 border-purple-500/20';
      case 'POSITION_CLOSED':
        return 'bg-gray-500/10 border-gray-500/20';
      default:
        return 'bg-gray-500/10 border-gray-500/20';
    }
  };

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Event Feed</h2>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded border bg-background px-3 py-1 text-sm"
        >
          <option value="all">All Events</option>
          <option value="burn">Burns</option>
          <option value="liquidity">Liquidity</option>
          <option value="trade">Trades</option>
          <option value="position">Positions</option>
        </select>
      </div>

      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No events yet. Waiting for real-time updates...
          </div>
        ) : (
          filteredEvents.map((event) => (
            <div
              key={event.id}
              className={`flex items-start gap-3 rounded-lg border p-4 ${getEventColor(event.type)}`}
            >
              <div className="mt-1">{getEventIcon(event.type)}</div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{event.type.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {event.type === 'BURN_DETECTED' && (
                    <>
                      Burned {formatNumber(Number(event.data.amount))} tokens (
                      {event.data.percentage.toFixed(2)}%)
                    </>
                  )}
                  {event.type === 'LIQUIDITY_CHANGED' && (
                    <>TVL changed by {event.data.changePercentage.toFixed(2)}%</>
                  )}
                  {event.type === 'TRADE_EXECUTED' && (
                    <>
                      {event.data.type} {formatNumber(Number(event.data.amountOut))} at{' '}
                      {formatNumber(Number(event.data.price))}
                    </>
                  )}
                  {event.type === 'POSITION_OPENED' && (
                    <>
                      Opened position: {formatNumber(Number(event.data.amount))} @{' '}
                      {formatNumber(Number(event.data.entryPrice))}
                    </>
                  )}
                  {event.type === 'POSITION_CLOSED' && (
                    <>Closed position: P&L {formatNumber(Number(event.data.pnlPercent))}%</>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
