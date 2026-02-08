'use client'

import { useState, useEffect } from 'react'
import { formatTimestamp } from '@/lib/utils'
import { workersAPI, type Worker } from '@/lib/api'
import { CheckCircle, XCircle, Clock, Activity, Zap, AlertCircle } from 'lucide-react'

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchWorkers = async () => {
    setLoading(true)
    try {
      const data = await workersAPI.getAll()
      setWorkers(data)
      setLastUpdate(new Date())
    } catch (error) {
      console.error('Error fetching workers:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWorkers()

    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchWorkers, 10000)

    return () => clearInterval(interval)
  }, [])

  const getStatusIcon = (status: Worker['status']) => {
    switch (status) {
      case 'RUNNING':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'STOPPED':
        return <Clock className="h-5 w-5 text-yellow-500" />
      case 'ERROR':
        return <XCircle className="h-5 w-5 text-red-500" />
    }
  }

  const getStatusColor = (status: Worker['status']) => {
    switch (status) {
      case 'RUNNING':
        return 'border-green-500/20 bg-green-500/5'
      case 'STOPPED':
        return 'border-yellow-500/20 bg-yellow-500/5'
      case 'ERROR':
        return 'border-red-500/20 bg-red-500/5'
    }
  }

  const getStatusBadgeColor = (status: Worker['status']) => {
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
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  const formatLastSeen = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSecs = Math.floor(diffMs / 1000)
    const diffMins = Math.floor(diffSecs / 60)

    if (diffSecs < 60) return `${diffSecs}s ago`
    if (diffMins < 60) return `${diffMins}m ago`
    return formatTimestamp(timestamp)
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Workers</h1>
          <p className="text-muted-foreground">Monitor worker status and metrics</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Activity className="h-4 w-4" />
          Last updated: {formatLastSeen(lastUpdate.toISOString())}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading workers...</div>
        </div>
      ) : workers.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">No workers found</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workers.map((worker) => (
            <div
              key={worker.name}
              className={`rounded-lg border-2 p-6 transition-all hover:shadow-lg ${getStatusColor(worker.status)}`}
            >
              {/* Header */}
              <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {getStatusIcon(worker.status)}
                  <div>
                    <h3 className="font-semibold text-lg">{worker.name}</h3>
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${getStatusBadgeColor(worker.status)}`}>
                      {worker.status}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatLastSeen(worker.lastSeen)}
                </div>
              </div>

              {/* Metrics */}
              <div className="space-y-3">
                {worker.metrics && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-md bg-muted/50 p-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                          <Zap className="h-3 w-3" />
                          Events Processed
                        </div>
                        <div className="text-lg font-semibold">
                          {worker.metrics.eventsProcessed?.toLocaleString() || 0}
                        </div>
                      </div>
                      <div className={`rounded-md bg-muted/50 p-3 ${worker.metrics.errors && worker.metrics.errors > 0 ? 'border border-red-500/20' : ''}`}>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                          <AlertCircle className={`h-3 w-3 ${worker.metrics.errors && worker.metrics.errors > 0 ? 'text-red-500' : ''}`} />
                          Errors
                        </div>
                        <div className={`text-lg font-semibold ${worker.metrics.errors && worker.metrics.errors > 0 ? 'text-red-500' : ''}`}>
                          {worker.metrics.errors?.toLocaleString() || 0}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-md bg-muted/50 p-3">
                      <div className="text-xs text-muted-foreground mb-1">Uptime</div>
                      <div className="text-lg font-semibold">
                        {formatUptime(worker.metrics.uptime)}
                      </div>
                    </div>

                    {worker.metrics.lastEventAt && (
                      <div className="text-xs text-muted-foreground">
                        Last event: {formatLastSeen(worker.metrics.lastEventAt)}
                      </div>
                    )}
                  </>
                )}

                {!worker.metrics && (
                  <div className="text-sm text-muted-foreground">
                    No metrics available
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="mt-8 rounded-lg border bg-card p-4">
        <h3 className="text-sm font-medium mb-3">Status Legend</h3>
        <div className="flex flex-wrap gap-6 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>Running - Worker is actively processing events</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-yellow-500" />
            <span>Stopped - Worker is not running</span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-500" />
            <span>Error - Worker has encountered an error</span>
          </div>
        </div>
      </div>
    </div>
  )
}
