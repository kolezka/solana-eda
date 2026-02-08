// API Response Types

export interface Worker {
  name: string
  status: 'RUNNING' | 'STOPPED' | 'ERROR'
  lastSeen: string
  metrics?: {
    eventsProcessed?: number
    errors?: number
    uptime?: number
    lastEventAt?: string
  }
}

export interface BurnEvent {
  id: string
  txSignature: string
  token: string
  amount: string
  percentage: number
  timestamp: string
  processed: boolean
}

export interface LiquidityEvent {
  id: string
  address: string
  tokenA: string
  tokenB: string
  tvl: string
  price: string
  volume24h: string
  updatedAt: string
}

export interface TradeEvent {
  id: string
  positionId: string
  type: 'BUY' | 'SELL'
  amount: string
  price: string
  signature: string
  slippage: number
  timestamp: string
  position?: {
    id: string
    token: string
    status: 'OPEN' | 'CLOSED'
  }
}

export interface PositionEvent {
  id: string
  token: string
  amount: string
  entryPrice: string
  currentPrice: string
  pnl: number
  status: 'OPEN' | 'CLOSED'
  openedAt: string
  closedAt?: string
  stopLoss?: string
  takeProfit?: string
  trades: Array<{
    id: string
    type: 'BUY' | 'SELL'
    amount: string
    price: string
    timestamp: string
  }>
}

export interface PriceEvent {
  id: string
  token: string
  price: string
  source: string
  confidence: number
  volume24h?: string
  timestamp: string
}

export interface Position {
  id: string
  token: string
  amount: number
  entryPrice: number
  currentPrice: number
  pnl: number
  status: 'OPEN' | 'CLOSED'
  stopLoss?: number
  takeProfit?: number
  openedAt: string
  closedAt?: string
  trades?: TradeEvent[]
}

export interface TradeSettings {
  id: string
  name: string
  enabled: boolean
  maxSlippage: number
  maxPositions: number
  stopLossPercent: number
  takeProfitPercent: number
  minBurnAmount: number
  updatedAt: string
}

export interface VolumeStats {
  period: string
  totalVolume: number
  winRate: number
  tradeCount: number
}

export interface PositionStats {
  totalValue: number
  totalPnl: number
  avgPnl: number
  winningPositions: number
  losingPositions: number
}

// WebSocket Event Types
export interface SocketMessage<T = any> {
  channel: string
  data: T
}

export interface AnyEvent {
  type: string
  timestamp: string
  id: string
  data: any
}
