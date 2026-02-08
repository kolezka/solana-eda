/**
 * Centralized API client for Solana EDA backend
 */
import type {
  BurnEvent,
  LiquidityEvent,
  TradeEvent,
  PositionEvent,
  PriceEvent,
  Position,
  PositionStats,
  TradeSettings,
  VolumeStats,
  Worker,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Base fetch wrapper with error handling
 */
async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `API Error (${response.status}): ${errorText || response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error(`API request failed: ${endpoint}`, error);
    throw error;
  }
}

/**
 * Workers API
 */
export const workersAPI = {
  getAll: () => fetchAPI<any[]>('/workers'),
  getRunning: () => fetchAPI<any[]>('/workers/running'),
  getErrors: () => fetchAPI<any[]>('/workers/errors'),
  getStale: (olderThanMinutes: number = 5) =>
    fetchAPI<any[]>(`/workers/stale?olderThanMinutes=${olderThanMinutes}`),
  getByName: (name: string) => fetchAPI<any>(`/workers/${name}`),
};

/**
 * Events API
 */
export const eventsAPI = {
  getAll: (limit = 50) => fetchAPI<any>(`/events?limit=${limit}`),
  getBurns: (limit = 50) => fetchAPI<BurnEvent[]>(`/events/burn?limit=${limit}`),
  getLiquidity: (limit = 50) =>
    fetchAPI<LiquidityEvent[]>(`/events/liquidity?limit=${limit}`),
  getTrades: (limit = 50) => fetchAPI<TradeEvent[]>(`/events/trades?limit=${limit}`),
  getPositions: (limit = 50) =>
    fetchAPI<PositionEvent[]>(`/events/positions?limit=${limit}`),
  getPrices: (limit = 100, token?: string) =>
    fetchAPI<PriceEvent[]>(`/events/prices?limit=${limit}${token ? `&token=${token}` : ''}`),
};

/**
 * Positions API
 */
export const positionsAPI = {
  getAll: () => fetchAPI<Position[]>('/positions'),
  getOpen: () => fetchAPI<Position[]>('/positions/open'),
  getClosed: (limit = 50) => fetchAPI<Position[]>(`/positions/closed?limit=${limit}`),
  getById: (id: string) => fetchAPI<Position>(`/positions/${id}`),
  getByToken: (token: string) => fetchAPI<Position[]>(`/positions/token/${token}`),
  getStats: () => fetchAPI<PositionStats>('/positions/stats'),
  updatePrice: (id: string, price: number) =>
    fetchAPI<Position>(`/positions/${id}/price`, {
      method: 'PUT',
      body: JSON.stringify({ price }),
    }),
  closePosition: (id: string, exitPrice: number, reason = 'MANUAL') =>
    fetchAPI<Position>(`/positions/${id}/close`, {
      method: 'POST',
      body: JSON.stringify({ exitPrice, reason }),
    }),
};

/**
 * Trading API
 */
export const tradingAPI = {
  getSettings: () => fetchAPI<TradeSettings[]>('/trading/settings'),
  getEnabledSettings: () => fetchAPI<TradeSettings[]>('/trading/settings/enabled'),
  getSettingsByName: (name: string) =>
    fetchAPI<TradeSettings>(`/trading/settings/${name}`),
  updateSettings: (id: string, data: Partial<TradeSettings>) =>
    fetchAPI<TradeSettings>(`/trading/settings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  toggleEnabled: (id: string) =>
    fetchAPI<TradeSettings>(`/trading/settings/${id}/toggle`, {
      method: 'PATCH',
    }),
  getTrades: (limit = 50) => fetchAPI<TradeEvent[]>(`/trading/trades?limit=${limit}`),
  getBuyTrades: (limit = 50) => fetchAPI<TradeEvent[]>(`/trading/trades/buy?limit=${limit}`),
  getSellTrades: (limit = 50) => fetchAPI<TradeEvent[]>(`/trading/trades/sell?limit=${limit}`),
  getVolumeStats: (days = 7) => fetchAPI<VolumeStats>(`/trading/stats/volume?days=${days}`),
};

/**
 * Re-export types for convenience
 */
export type {
  Worker,
  BurnEvent,
  LiquidityEvent,
  TradeEvent,
  PositionEvent,
  PriceEvent,
  Position,
  TradeSettings,
  VolumeStats,
  PositionStats,
} from './types';
