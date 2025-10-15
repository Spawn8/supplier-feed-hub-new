'use client'

import { useState, useEffect, useRef } from 'react'

interface LastImportCellProps {
  supplierId: string
}

interface ImportData {
  last_sync_at?: string
  last_sync_status: string
  last_sync_started_at?: string
  last_sync_completed_at?: string
  last_sync_duration_ms?: number
  last_sync_items_total: number
  last_sync_items_success: number
  last_sync_items_errors: number
  last_sync_error_message?: string
  creation_started_at?: string
  creation_completed_at?: string
}

export default function LastImportCell({ supplierId }: LastImportCellProps) {
  const [importData, setImportData] = useState<ImportData | null>(null)
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const lastSnapshotRef = useRef<string>('')
  const backoffRef = useRef<number>(2000) // start at 2s

  useEffect(() => {
    fetchImportData()
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [supplierId])

  const fetchImportData = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/suppliers/${supplierId}/stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      const data = await response.json()

      if (response.ok) {
        const snapshot = JSON.stringify({
          s: data.stats?.last_sync_status,
          c: data.stats?.last_sync_completed_at,
          st: data.stats?.last_sync_started_at,
          tot: data.stats?.last_sync_items_total,
          ok: data.stats?.last_sync_items_success,
          err: data.stats?.last_sync_items_errors,
        })
        if (snapshot !== lastSnapshotRef.current) {
          lastSnapshotRef.current = snapshot
          setImportData(data.stats)
        }
        // reset backoff on success
        backoffRef.current = 2000
        
        // Only start polling if status is 'running' and we're not already polling
        if (data.stats.last_sync_status === 'running' && !isPolling) {
          setIsPolling(true)
          startPolling()
        }
        // Stop polling if status is not running and we were polling
        else if (data.stats.last_sync_status !== 'running' && isPolling) {
          setIsPolling(false)
          stopPolling()
        }
      }
    } catch (error) {
      console.error('Error fetching import data:', error)
      // gentle backoff on error (max 20s)
      backoffRef.current = Math.min(backoffRef.current * 2, 20000)
    } finally {
      setLoading(false)
    }
  }

  const startPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    
    const tick = async () => {
      if (document.hidden) {
        // pause while tab hidden, try again soon
        intervalRef.current = setTimeout(tick, 1500) as any
        return
      }
      await fetchImportData()
      // dynamic backoff: faster while running, otherwise stopped by caller
      const delay = backoffRef.current
      intervalRef.current = setTimeout(tick, delay) as any
    }
    tick()
  }

  const stopPolling = () => {
    if (intervalRef.current) {
      clearTimeout(intervalRef.current as any)
      intervalRef.current = null
    }
  }

  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600'
      case 'failed':
        return 'text-red-600'
      case 'running':
        return 'text-blue-600'
      case 'never':
        return 'text-gray-500'
      default:
        return 'text-gray-600'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed'
      case 'failed':
        return 'Failed'
      case 'running':
        return 'Running'
      case 'never':
        return 'Never'
      default:
        return 'Never'
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-20"></div>
      </div>
    )
  }

  // Determine the timestamp and status to show based on your logic
  const getDisplayInfo = () => {
    if (!importData) return { status: 'never', timestamp: null, showTimestamp: false }
    
    const status = importData.last_sync_status || 'never'
    
    console.log('LastImportCell - getDisplayInfo:', {
      status,
      creation_completed_at: importData.creation_completed_at,
      last_sync_completed_at: importData.last_sync_completed_at,
      last_sync_started_at: importData.last_sync_started_at,
      importDataKeys: Object.keys(importData)
    })
    
    // If never synced, show "Never" with no timestamp
    if (status === 'never') {
      return {
        status: 'never',
        timestamp: null,
        showTimestamp: false
      }
    }
    
    // If running, show "running" without timestamp
    if (status === 'running') {
      return {
        status: 'running',
        timestamp: null,
        showTimestamp: false
      }
    }
    
    // If completed or failed, show last_sync_completed_at only
    if (status === 'completed' || status === 'failed') {
      const timestamp = importData.last_sync_completed_at || null
      return {
        status: status,
        timestamp,
        showTimestamp: Boolean(timestamp)
      }
    }
    
    // Fallback
    return { status, timestamp: null, showTimestamp: false }
  }

  const { status, timestamp, showTimestamp } = getDisplayInfo()

  if (!importData) {
    return (
      <span className="text-gray-500 text-sm">Never</span>
    )
  }

  return (
    <div className="text-sm">
      <div className={`font-medium ${getStatusColor(status)}`}>
        {getStatusText(status)}
      </div>
      {showTimestamp && timestamp && (
        <div className="text-xs text-gray-500">
          {formatTimestamp(timestamp)}
        </div>
      )}
      {showTimestamp && !timestamp && (
        <div className="text-xs text-red-500">
          No timestamp available
        </div>
      )}
      {status !== 'never' && status !== 'running' && importData.last_sync_items_success > 0 && (
        <div className="text-xs text-gray-500">
          {importData.last_sync_items_success.toLocaleString()} items
          {importData.last_sync_items_errors > 0 && (
            <span className="text-red-500 ml-1">
              ({importData.last_sync_items_errors} errors)
            </span>
          )}
        </div>
      )}
    </div>
  )
}