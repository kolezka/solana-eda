'use client'

import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import DashboardLayout from '@/components/layout/DashboardLayout'
import EventFeed from '@/components/events/EventFeed'
import WorkerStatus from '@/components/workers/WorkerStatus'
import PositionsOverview from '@/components/positions/PositionsOverview'
import TradingStats from '@/components/trading/TradingStats'
import { PnLChart, VolumeChart, BurnTrendChart, WinRateChart } from '@/components/ui/charts'

interface Event {
  type: string
  data: any
  timestamp: string
  id: string
}

export default function DashboardPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [connected, setConnected] = useState(false)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [priceData, setPriceData] = useState<{ token: string; price: number; timestamp: string }[]>([])

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000'
    const newSocket = io(wsUrl)

    newSocket.on('connect', () => {
      console.log('Connected to WebSocket')
      setConnected(true)

      // Subscribe to all channels including price events
      newSocket.emit('subscribe', 'events:burn')
      newSocket.emit('subscribe', 'events:liquidity')
      newSocket.emit('subscribe', 'events:trades')
      newSocket.emit('subscribe', 'events:positions')
      newSocket.emit('subscribe', 'events:price')
      newSocket.emit('subscribe', 'workers:status')
    })

    newSocket.on('disconnect', () => {
      console.log('Disconnected from WebSocket')
      setConnected(false)
    })

    newSocket.on('event', (data: { channel: string; data: Event }) => {
      setEvents((prev) => [data.data, ...prev].slice(0, 100))

      // Track price updates for charts
      if (data.channel === 'events:price' && data.data.type === 'PRICE_UPDATE') {
        setPriceData((prev) => {
          const newPriceData = {
            token: data.data.data.token,
            price: parseFloat(data.data.data.price),
            timestamp: data.data.timestamp,
          }

          // Keep only last 50 price points per token
          const filtered = prev.filter(p => p.token !== newPriceData.token)
          return [...filtered, newPriceData].slice(-50)
        })
      }
    })

    newSocket.on('subscribed', (data) => {
      console.log('Subscribed to:', data.channel)
    })

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  }, [])

  // Prepare chart data from events
  const burnChartData = events
    .filter(e => e.type === 'BURN_DETECTED')
    .map(e => ({
      timestamp: e.timestamp,
      burns: 1,
      amount: parseFloat(e.data.amount || '0'),
    }))
    .slice(-50)

  // Get unique tokens from price data
  const uniqueTokens = Array.from(new Set(priceData.map(p => p.token))).slice(0, 5)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Solana EDA Dashboard</h1>
            <p className="text-muted-foreground">Real-time trading bot monitoring</p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                connected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-sm text-muted-foreground">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <TradingStats />
        </div>

        {/* Charts Section */}
        <div className="grid gap-6 md:grid-cols-2">
          {burnChartData.length > 0 && (
            <div className="rounded-lg border bg-card p-6">
              <h2 className="text-lg font-semibold mb-4">Burn Trend (Last 50)</h2>
              <BurnTrendChart data={burnChartData} height={200} />
            </div>
          )}
          {priceData.length > 0 && (
            <div className="rounded-lg border bg-card p-6">
              <h2 className="text-lg font-semibold mb-4">Price Updates</h2>
              <PnLChart
                data={priceData.map(p => ({ timestamp: p.timestamp, pnl: p.price }))}
                height={200}
              />
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column */}
          <div className="space-y-6 lg:col-span-2">
            <PositionsOverview />
            <EventFeed events={events} />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <WorkerStatus />
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
