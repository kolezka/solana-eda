'use client'

import { useEffect, useState } from 'react'
import { DollarSign, TrendingUp, Activity, Target } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export default function TradingStats() {
  const [stats, setStats] = useState({
    totalVolume: 0,
    winRate: 0,
    tradesToday: 0,
    totalPositions: 0,
  })

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 10000) // Refresh every 10 seconds
    return () => clearInterval(interval)
  }, [])

  async function fetchStats() {
    try {
      const api_url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
      const [volumeRes, posRes] = await Promise.all([
        fetch(`${api_url}/trading/stats/volume?days=1`),
        fetch(`${api_url}/positions`),
      ])

      const volumeData = await volumeRes.json()
      const positionsData = await posRes.json()

      setStats({
        totalVolume: volumeData.totalVolume || 0,
        winRate: volumeData.winRate || 0,
        tradesToday: volumeData.tradeCount || 0,
        totalPositions: positionsData.length || 0,
      })
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const statCards = [
    {
      title: '24h Volume',
      value: formatCurrency(stats.totalVolume),
      icon: DollarSign,
      color: 'text-blue-500',
    },
    {
      title: 'Win Rate',
      value: `${stats.winRate.toFixed(1)}%`,
      icon: TrendingUp,
      color: 'text-green-500',
    },
    {
      title: 'Trades Today',
      value: stats.tradesToday,
      icon: Activity,
      color: 'text-purple-500',
    },
    {
      title: 'Open Positions',
      value: stats.totalPositions,
      icon: Target,
      color: 'text-orange-500',
    },
  ]

  return (
    <>
      {statCards.map((stat) => {
        const Icon = stat.icon
        return (
          <div key={stat.title} className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">{stat.title}</div>
                <div className="mt-2 text-2xl font-bold">{stat.value}</div>
              </div>
              <Icon className={`h-8 w-8 ${stat.color}`} />
            </div>
          </div>
        )
      })}
    </>
  )
}
