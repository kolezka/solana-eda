'use client'

import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatCurrency, formatNumber, formatTimestamp } from '@/lib/utils'
import { positionsAPI, type Position } from '@/lib/api'
import { PnLChart } from '@/components/ui/charts'
import { TrendingUp, TrendingDown, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

type PositionType = 'open' | 'closed'

export default function PositionsPage() {
  const [activeTab, setActiveTab] = useState<PositionType>('open')
  const [positions, setPositions] = useState<Position[]>([])
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [positionToClose, setPositionToClose] = useState<Position | null>(null)
  const [closing, setClosing] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [positionsData, statsData] = await Promise.all([
        activeTab === 'open' ? positionsAPI.getOpen() : positionsAPI.getClosed(100),
        positionsAPI.getStats(),
      ])
      setPositions(positionsData)
      setStats(statsData)
    } catch (error) {
      console.error('Error fetching positions:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [activeTab])

  const handleClosePosition = async () => {
    if (!positionToClose) return

    setClosing(true)
    try {
      await positionsAPI.closePosition(positionToClose.id, Number(positionToClose.currentPrice))
      setCloseDialogOpen(false)
      setPositionToClose(null)
      fetchData()
    } catch (error) {
      console.error('Error closing position:', error)
    } finally {
      setClosing(false)
    }
  }

  const initiateClose = (position: Position) => {
    setPositionToClose(position)
    setCloseDialogOpen(true)
  }

  // Prepare P&L chart data from closed positions
  const pnlChartData = positions
    .filter(p => p.status === 'CLOSED' && p.closedAt)
    .map(p => ({
      timestamp: p.closedAt!,
      pnl: p.pnl,
    }))
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Positions</h1>
        <p className="text-muted-foreground">Manage your trading positions</p>
      </div>

      {/* Portfolio Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="rounded-lg border bg-card p-6">
            <div className="text-sm text-muted-foreground">Total Value</div>
            <div className="mt-2 text-2xl font-bold">{formatCurrency(stats.totalValue)}</div>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <div className="text-sm text-muted-foreground">Total P&L</div>
            <div className={`mt-2 text-2xl font-bold ${stats.totalPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {stats.totalPnl >= 0 ? '+' : ''}{formatCurrency(stats.totalPnl)}
            </div>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <div className="text-sm text-muted-foreground">Avg P&L</div>
            <div className={`mt-2 text-2xl font-bold ${stats.avgPnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {stats.avgPnl >= 0 ? '+' : ''}{stats.avgPnl.toFixed(2)}%
            </div>
          </div>
          <div className="rounded-lg border bg-card p-6">
            <div className="text-sm text-muted-foreground">Win Rate</div>
            <div className="mt-2 text-2xl font-bold">
              {stats.totalPositions > 0
                ? ((stats.winningPositions / stats.totalPositions) * 100).toFixed(1)
                : '0'}%
            </div>
          </div>
        </div>
      )}

      {/* P&L Chart for closed positions */}
      {activeTab === 'closed' && pnlChartData.length > 0 && (
        <div className="rounded-lg border bg-card p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">P&L Over Time</h2>
          <PnLChart data={pnlChartData} height={250} />
        </div>
      )}

      {/* Tabs for Open/Closed */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PositionType)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="open">Open Positions ({positions.filter(p => p.status === 'OPEN').length})</TabsTrigger>
          <TabsTrigger value="closed">Closed Positions ({positions.filter(p => p.status === 'CLOSED').length})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">Loading positions...</div>
            </div>
          ) : positions.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-muted-foreground">No {activeTab} positions found</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {positions.map((position) => (
                <div
                  key={position.id}
                  className="rounded-lg border bg-card p-6"
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">{position.token}</h3>
                      <p className="text-sm text-muted-foreground">{formatNumber(position.amount)} tokens</p>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs font-medium ${
                      position.status === 'OPEN' ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500'
                    }`}>
                      {position.status}
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Entry Price:</span>
                      <span>{formatCurrency(position.entryPrice)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Current Price:</span>
                      <span>{formatCurrency(position.currentPrice)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">P&L:</span>
                      <span className={`font-medium flex items-center gap-1 ${
                        position.pnl >= 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {position.pnl >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {position.pnl >= 0 ? '+' : ''}{position.pnl.toFixed(2)}%
                      </span>
                    </div>
                    {position.stopLoss && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Stop Loss:</span>
                        <span>{position.stopLoss}%</span>
                      </div>
                    )}
                    {position.takeProfit && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Take Profit:</span>
                        <span>{position.takeProfit}%</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Opened:</span>
                      <span>{formatTimestamp(position.openedAt)}</span>
                    </div>
                  </div>

                  {position.status === 'OPEN' && (
                    <button
                      onClick={() => initiateClose(position)}
                      className="mt-4 w-full flex items-center justify-center gap-2 rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
                    >
                      <X className="h-4 w-4" />
                      Close Position
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Close Position Dialog */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close Position</DialogTitle>
            <DialogDescription>
              Are you sure you want to close this position? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {positionToClose && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Token:</span>
                  <p className="font-medium">{positionToClose.token}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Amount:</span>
                  <p className="font-medium">{formatNumber(positionToClose.amount)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Entry Price:</span>
                  <p className="font-medium">{formatCurrency(positionToClose.entryPrice)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Current Price:</span>
                  <p className="font-medium">{formatCurrency(positionToClose.currentPrice)}</p>
                </div>
              </div>
              <div className={`p-4 rounded-lg border ${positionToClose.pnl >= 0 ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                <div className="text-sm text-muted-foreground">Unrealized P&L</div>
                <div className={`text-lg font-bold ${positionToClose.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {positionToClose.pnl >= 0 ? '+' : ''}{positionToClose.pnl.toFixed(2)}%
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <button
              onClick={() => setCloseDialogOpen(false)}
              disabled={closing}
              className="px-4 py-2 rounded-md border hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleClosePosition}
              disabled={closing}
              className="px-4 py-2 rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {closing ? 'Closing...' : 'Close Position'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
