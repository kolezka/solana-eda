'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Clock, Activity } from 'lucide-react'
import { formatTimestamp } from '@/lib/utils'

interface Worker {
  name: string
  status: 'RUNNING' | 'STOPPED' | 'ERROR'
  lastSeen: string
  metrics?: {
    eventsProcessed?: number
    errors?: number
    uptime?: number
  }
}

export default function WorkerStatus() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchWorkers = async () => {
    try {
      setError(null)
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
      const response = await fetch(`${API_URL}/workers`)

      if (!response.ok) {
        throw new Error(`Failed to fetch workers: ${response.status}`)
      }

      const data = await response.json()
      setWorkers(data)
    } catch (err) {
      console.error('Error fetching workers:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch workers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWorkers()

    // Poll every 10 seconds
    const interval = setInterval(fetchWorkers, 10000)

    return () => clearInterval(interval)
  }, [])

  const getStatusIcon = (status: Worker['status']) => {
    switch (status) {
      case 'RUNNING':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'STOPPED':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'ERROR':
        return <XCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getStatusBadge = (status: Worker['status']) => {
    switch (status) {
      case 'RUNNING':
        return 'bg-green-500/10 text-green-500'
      case 'STOPPED':
        return 'bg-yellow-500/10 text-yellow-500'
      case 'ERROR':
        return 'bg-red-500/10 text-red-500'
    }
  }

  const formatUptime = (ms?: number) => {
    if (!ms) return 'N/A'
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Worker Status</h2>
        <Activity className="h-5 w-5 text-muted-foreground" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-sm text-muted-foreground">Loading workers...</div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-sm text-red-500">Error: {error}</div>
        </div>
      ) : workers.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-sm text-muted-foreground">No workers found</div>
        </div>
      ) : (
        <div className="space-y-3">
          {workers.map((worker) => (
            <div
              key={worker.name}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {getStatusIcon(worker.status)}
                  <span className="font-medium">{worker.name}</span>
                  <span className={`rounded px-2 py-0.5 text-xs ${getStatusBadge(worker.status)}`}>
                    {worker.status}
                  </span>
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Events: {worker.metrics?.eventsProcessed ?? 0} | Errors: {worker.metrics?.errors ?? 0} | Uptime:{' '}
                  {formatUptime(worker.metrics?.uptime)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
