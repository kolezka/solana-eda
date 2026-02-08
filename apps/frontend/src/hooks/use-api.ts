'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

/**
 * Generic polling hook with loading/error states
 */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  interval: number = 10000,
  immediate: boolean = true,
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const result = await fetcher();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
      console.error('Polling error:', err);
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    if (immediate) {
      fetchData();
    }

    intervalRef.current = setInterval(fetchData, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchData, interval, immediate]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
}

/**
 * Socket.io subscription hook
 */
export function useSocket(channel: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000';
    const socketInstance = io(wsUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketInstance.on('connect', () => {
      setConnected(true);
      console.log('WebSocket connected');
    });

    socketInstance.on('disconnect', () => {
      setConnected(false);
      console.log('WebSocket disconnected');
    });

    socketInstance.on('connect_error', (err) => {
      setError(err);
      console.error('WebSocket connection error:', err);
    });

    // Subscribe to the channel
    if (channel) {
      socketInstance.emit('subscribe', channel);
    }

    setSocket(socketInstance);

    return () => {
      if (channel) {
        socketInstance.emit('unsubscribe', channel);
      }
      socketInstance.disconnect();
    };
  }, [channel]);

  return { socket, connected, error };
}

/**
 * Hook for subscribing to real-time events
 */
export function useEvents(channel: string) {
  const { socket, connected, error } = useSocket(channel);
  const [events, setEvents] = useState<any[]>([]);
  const latestEventRef = useRef<any>(null);

  useEffect(() => {
    if (!socket || !connected) return;

    const handleEvent = (data: { channel: string; data: any }) => {
      if (data.channel === channel || data.channel === 'events:price') {
        latestEventRef.current = data.data;
        setEvents((prev) => [data.data, ...prev].slice(0, 100)); // Keep last 100 events
      }
    };

    socket.on('event', handleEvent);

    return () => {
      socket.off('event', handleEvent);
    };
  }, [socket, connected, channel]);

  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  return {
    events,
    latestEvent: latestEventRef.current,
    connected,
    error,
    clearEvents,
  };
}
