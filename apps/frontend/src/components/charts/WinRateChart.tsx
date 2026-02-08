'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface WinRateChartProps {
  winningTrades: number;
  losingTrades: number;
  height?: number;
}

const COLORS = {
  win: 'hsl(142, 76%, 36%)',
  loss: 'hsl(0, 84%, 60%)',
};

export function WinRateChart({ winningTrades, losingTrades, height = 300 }: WinRateChartProps) {
  const totalTrades = winningTrades + losingTrades;

  if (totalTrades === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-sm text-muted-foreground">No trade data available</p>
      </div>
    );
  }

  const winRate = (winningTrades / totalTrades) * 100;

  const data = [
    { name: 'Winning Trades', value: winningTrades, color: COLORS.win },
    { name: 'Losing Trades', value: losingTrades, color: COLORS.loss },
  ];

  return (
    <div className="flex items-center justify-between">
      <ResponsiveContainer width="60%" height={height}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={60}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: '0.5rem',
            }}
            labelStyle={{ color: 'hsl(var(--foreground))' }}
            formatter={(value: number, name: string) => [value, name]}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="flex flex-col items-center justify-center">
        <div className="text-4xl font-bold">{winRate.toFixed(1)}%</div>
        <div className="text-sm text-muted-foreground">Win Rate</div>
        <div className="mt-4 space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS.win }} />
            <span>Wins: {winningTrades}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS.loss }} />
            <span>Losses: {losingTrades}</span>
          </div>
          <div className="text-muted-foreground">Total: {totalTrades}</div>
        </div>
      </div>
    </div>
  );
}
