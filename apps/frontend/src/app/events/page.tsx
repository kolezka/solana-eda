'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatCurrency, formatTimestamp, formatNumber } from '@/lib/utils'
import { eventsAPI, type BurnEvent, type LiquidityEvent, type TradeEvent, type PositionEvent } from '@/lib/api'
import { Flame, Droplets, TrendingUp, Wallet } from 'lucide-react'

type EventType = 'all' | 'burns' | 'liquidity' | 'trades' | 'positions'

export default function EventsPage() {
  const [activeTab, setActiveTab] = useState<EventType>('all')
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const fetchEvents = async () => {
    setLoading(true)
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
      let data: any[] = []

      switch (activeTab) {
        case 'all':
          const allData = await eventsAPI.getAll(50)
          // Combine all event types
          data = [
            ...allData.burnEvents.map((e: BurnEvent) => ({ ...e, type: 'burn' })),
            ...allData.liquidityEvents.map((e: LiquidityEvent) => ({ ...e, type: 'liquidity' })),
            ...allData.tradeEvents.map((e: TradeEvent) => ({ ...e, type: 'trade' })),
            ...allData.positionEvents.map((e: PositionEvent) => ({ ...e, type: 'position' })),
          ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          break
        case 'burns':
          data = await eventsAPI.getBurns(100)
          break
        case 'liquidity':
          data = await eventsAPI.getLiquidity(100)
          break
        case 'trades':
          data = await eventsAPI.getTrades(100)
          break
        case 'positions':
          data = await eventsAPI.getPositions(100)
          break
      }

      setEvents(data)
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [activeTab])

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'burn':
        return <Flame className="h-4 w-4 text-orange-500" />
      case 'liquidity':
        return <Droplets className="h-4 w-4 text-blue-500" />
      case 'trade':
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'position':
        return <Wallet className="h-4 w-4 text-purple-500" />
      default:
        return null
    }
  }

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'burn':
        return 'Token Burn'
      case 'liquidity':
        return 'Liquidity Change'
      case 'trade':
        return 'Trade Executed'
      case 'position':
        return 'Position Update'
      default:
        return type
    }
  }

  const getEventSummary = (event: any) => {
    if (event.type === 'burn' || activeTab === 'burns') {
      return `${formatNumber(event.amount)} ${event.token} burned (${event.percentage.toFixed(2)}%)`
    } else if (event.type === 'liquidity' || activeTab === 'liquidity') {
      return `${event.tokenA}/${event.tokenB}: TVL ${formatCurrency(event.tvl)}`
    } else if (event.type === 'trade' || activeTab === 'trades') {
      return `${event.type} ${formatNumber(event.amount)} @ ${formatCurrency(event.price)}`
    } else if (event.type === 'position' || activeTab === 'positions') {
      return `${event.token}: ${formatNumber(event.amount)} @ ${formatCurrency(event.entryPrice)} (P&L: ${event.pnl >= 0 ? '+' : ''}${event.pnl.toFixed(2)}%)`
    }
    return 'Unknown event type'
  }

  const handleRowClick = (event: any) => {
    setSelectedEvent(event)
    setDialogOpen(true)
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Events</h1>
        <p className="text-muted-foreground">View all blockchain and trading events</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as EventType)}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="burns">Burns</TabsTrigger>
          <TabsTrigger value="liquidity">Liquidity</TabsTrigger>
          <TabsTrigger value="trades">Trades</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading events...</div>
            </div>
          ) : events.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">No events found</div>
            </div>
          ) : (
            <div className="rounded-lg border bg-card">
              <div className="grid grid-cols-5 gap-4 border-b p-4 text-sm font-medium text-muted-foreground">
                <div>Type</div>
                <div>Summary</div>
                <div>Details</div>
                <div>Timestamp</div>
                <div>Signature</div>
              </div>
              <div className="divide-y">
                {events.map((event, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-5 gap-4 p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => handleRowClick(event)}
                  >
                    <div className="flex items-center gap-2">
                      {getEventIcon(event.type || activeTab.slice(0, -1))}
                      <span className="text-sm font-medium">
                        {getEventTypeLabel(event.type || activeTab.slice(0, -1))}
                      </span>
                    </div>
                    <div className="text-sm">{getEventSummary(event)}</div>
                    <div className="text-sm text-muted-foreground">
                      {event.token && <span>Token: {event.token.slice(0, 8)}...</span>}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatTimestamp(event.timestamp || event.updatedAt)}
                    </div>
                    <div className="text-sm text-muted-foreground font-mono">
                      {(event.txSignature || event.signature || event.id || '').slice(0, 8)}...
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Event Details</DialogTitle>
            <DialogDescription>Full event information</DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Type</label>
                  <p className="mt-1">{getEventTypeLabel(selectedEvent.type || activeTab.slice(0, -1))}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Timestamp</label>
                  <p className="mt-1">{formatTimestamp(selectedEvent.timestamp || selectedEvent.updatedAt)}</p>
                </div>
              </div>

              {selectedEvent.token && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Token</label>
                  <p className="mt-1 font-mono">{selectedEvent.token}</p>
                </div>
              )}

              {selectedEvent.amount && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Amount</label>
                  <p className="mt-1">{formatNumber(selectedEvent.amount)}</p>
                </div>
              )}

              {selectedEvent.percentage !== undefined && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Percentage</label>
                  <p className="mt-1">{selectedEvent.percentage.toFixed(2)}%</p>
                </div>
              )}

              {selectedEvent.tvl && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">TVL</label>
                  <p className="mt-1">{formatCurrency(selectedEvent.tvl)}</p>
                </div>
              )}

              {selectedEvent.price && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Price</label>
                  <p className="mt-1">{formatCurrency(selectedEvent.price)}</p>
                </div>
              )}

              {selectedEvent.entryPrice && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Entry Price</label>
                    <p className="mt-1">{formatCurrency(selectedEvent.entryPrice)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Current Price</label>
                    <p className="mt-1">{formatCurrency(selectedEvent.currentPrice)}</p>
                  </div>
                </div>
              )}

              {selectedEvent.pnl !== undefined && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">P&L</label>
                  <p className={`mt-1 ${selectedEvent.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {selectedEvent.pnl >= 0 ? '+' : ''}{selectedEvent.pnl.toFixed(2)}%
                  </p>
                </div>
              )}

              {(selectedEvent.txSignature || selectedEvent.signature) && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Transaction Signature</label>
                  <p className="mt-1 font-mono text-xs break-all">
                    {selectedEvent.txSignature || selectedEvent.signature}
                  </p>
                </div>
              )}

              <div className="pt-4 border-t">
                <label className="text-sm font-medium text-muted-foreground">Raw Data</label>
                <pre className="mt-2 text-xs bg-muted p-4 rounded overflow-auto max-h-48">
                  {JSON.stringify(selectedEvent, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
