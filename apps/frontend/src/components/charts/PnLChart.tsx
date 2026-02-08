'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

interface PnLDataPoint {
  timestamp: string
  pnl: number
}

interface PnLChartProps {
  data: PnLDataPoint[]
  height?: number
}

export function PnLChart({ data, height = 300 }: PnLChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-sm text-muted-foreground">No P&L data available</p>
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
      <LineChart data={formattedData}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="time"
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={12}
          tickLine={false}
          tickFormatter={(value) => `$${value.toFixed(2)}`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--card))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '0.5rem',
          }}
          labelStyle={{ color: 'hsl(var(--foreground))' }}
          formatter={(value: number) => [`$${value.toFixed(2)}`, 'P&L']}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="pnl"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={false}
          name="P&L"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
