'use client'

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface BurnTrendDataPoint {
  timestamp: string
  burns: number
  amount: number
}

interface BurnTrendChartProps {
  data: BurnTrendDataPoint[]
  height?: number
}

export function BurnTrendChart({ data, height = 300 }: BurnTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-sm text-muted-foreground">No burn trend data available</p>
      </div>
    )
  }

  // Format timestamp for display
  const formattedData = data.map((point) => ({
    ...point,
    time: new Date(point.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={formattedData}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="time"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
        />
        <YAxis
          yAxisId="left"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          label={{ value: 'Burns', angle: -90, position: 'insideLeft' }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          label={{ value: 'Amount', angle: 90, position: 'insideRight' }}
          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '0.5rem',
          }}
          labelStyle={{ color: 'hsl(var(--foreground))' }}
        />
        <Area
          yAxisId="left"
          type="monotone"
          dataKey="burns"
          stroke="hsl(var(--chart-1, 270, 70%))"
          fill="hsl(var(--chart-1, 270, 70%))"
          fillOpacity={0.6}
          name="Burn Count"
        />
        <Area
          yAxisId="right"
          type="monotone"
          dataKey="amount"
          stroke="hsl(var(--chart-2, 280, 70%))"
          fill="hsl(var(--chart-2, 280, 70%))"
          fillOpacity={0.6}
          name="Burn Amount"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
