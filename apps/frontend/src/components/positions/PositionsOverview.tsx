'use client'

import { useEffect, useState } from 'react'
import { formatCurrency, formatPercentage, formatTimestamp } from '@/lib/utils'
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'

interface Position {
  id: string
  token: string
  amount: string
  entryPrice: string
  currentPrice: string
  pnl: string
  status: 'OPEN' | 'CLOSED'
  openedAt: string
}

export default function PositionsOverview() {
  const [positions, setPositions] = useState<Position[]>([])

  useEffect(() => {
    // Fetch positions from API
    fetchPositions()
    const interval = setInterval(fetchPositions, 5000) // Refresh every 5 seconds
    return () => clearInterval(interval)
  }, [])

  async function fetchPositions() {
    try {
      const api_url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
      const response = await fetch(`${api_url}/positions/open`)
      const data = await response.json()
      setPositions(data)
    } catch (error) {
      console.error('Error fetching positions:', error)
    }
  }

  const totalValue = positions.reduce(
    (sum, pos) => sum + Number(pos.amount) * Number(pos.currentPrice),
    0
  )

  const totalPnl = positions.reduce((sum, pos) => sum + Number(pos.pnl), 0)

  const getPnlIcon = (pnl: number) => {
    if (pnl > 0) return <ArrowUpRight className="h-4 w-4 text-green-500" />
    if (pnl < 0) return <ArrowDownRight className="h-4 w-4 text-red-500" />
    return <Minus className="h-4 w-4 text-gray-500" />
  }

  const getPnlColor = (pnl: number) => {
    if (pnl > 0) return 'text-green-500'
    if (pnl < 0) return 'text-red-500'
    return 'text-gray-500'
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Open Positions</h2>
        <span className="text-sm text-muted-foreground">{positions.length} positions</span>
      </div>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-accent p-4">
          <div className="text-sm text-muted-foreground">Total Value</div>
          <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
        </div>
        <div className="rounded-lg bg-accent p-4">
          <div className="text-sm text-muted-foreground">Total P&L</div>
          <div className={`text-2xl font-bold flex items-center gap-2 ${getPnlColor(totalPnl)}`}>
            {getPnlIcon(totalPnl)}
            {formatPercentage(totalPnl)}
          </div>
        </div>
      </div>

      {/* Positions Table */}
      {positions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No open positions. Waiting for trades...
        </div>
      ) : (
        <div className="space-y-3">
          {positions.map((position) => (
            <div key={position.id} className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex-1">
                <div className="font-medium">{position.token}</div>
                <div className="text-sm text-muted-foreground">
                  {formatCurrency(Number(position.amount) * Number(position.currentPrice))}
                </div>
              </div>
              <div className="text-right">
                <div className={getPnlColor(Number(position.pnl))}>
                  {formatPercentage(Number(position.pnl))}
                </div>
                <div className="text-sm text-muted-foreground">
                  {formatTimestamp(position.openedAt)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
