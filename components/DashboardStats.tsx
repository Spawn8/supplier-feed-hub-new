'use client'

import { useState, useEffect, useRef } from 'react'
import DashboardInsights from '@/components/DashboardInsights'
import { useWorkspace } from '@/lib/workspaceContext'

interface DashboardStats {
  total_suppliers: number
  total_products: number
  total_exports: number
  last_sync_at?: string
  active_suppliers: number
  error_suppliers: number
  draft_suppliers?: number
  paused_suppliers?: number
  total_workspaces?: number
  recent_activity: Array<{
    id: string
    action: string
    resource_type: string
    resource_name: string
    created_at: string
  }>
}

export default function DashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const snapshotRef = useRef<string>('')
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const backoffRef = useRef<number>(3000)
  const isPollingRef = useRef<boolean>(false)
  const { activeWorkspaceId, isWorkspaceReady } = useWorkspace()

  useEffect(() => {
    if (isWorkspaceReady && activeWorkspaceId) {
      fetchStats()
    }
  }, [isWorkspaceReady, activeWorkspaceId])

  // Manual refresh trigger from dashboard page
  useEffect(() => {
    const handler = () => fetchStats()
    window.addEventListener('dashboard:refresh', handler as any)
    return () => window.removeEventListener('dashboard:refresh', handler as any)
  }, [])

  // Do not force-refresh on focus; keep data and resume timers only

  const fetchStats = async (retryCount = 0) => {
    try {
      setLoading(true)
      const response = await fetch('/api/dashboard/stats', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        // If it's a workspace error and we haven't retried too many times, retry after a delay
        if (data.error === 'No workspace selected' && retryCount < 3) {
          console.log(`Retrying dashboard stats fetch (attempt ${retryCount + 1})`)
          setTimeout(() => {
            fetchStats(retryCount + 1)
          }, 500)
          return
        }
        throw new Error(data.error || 'Failed to load dashboard stats')
      }

      const snapshot = JSON.stringify({
        ls: data.stats?.last_sync_at,
        act: data.stats?.active_suppliers,
        err: data.stats?.error_suppliers,
        dr: data.stats?.draft_suppliers,
        pa: data.stats?.paused_suppliers,
        totS: data.stats?.total_suppliers,
        totP: data.stats?.total_products,
        totE: data.stats?.total_exports,
        ra: (data.stats?.recent_activity || []).slice(0,3),
      })
      const missingNewFields = typeof (stats as any)?.draft_suppliers === 'undefined' || typeof (stats as any)?.paused_suppliers === 'undefined'
      if (snapshot !== snapshotRef.current || missingNewFields) {
        snapshotRef.current = snapshot
        setStats(data.stats)
      }
      setError(null)
      backoffRef.current = 3000

      // Decide polling based on any running supplier (API should expose this soon).
      // For now, infer from recent activity: if the most recent action is a sync start and
      // we have no completed/failed yet, keep polling briefly; otherwise stop.
      const recent = data?.stats?.recent_activity || []
      const hasSyncActivity = recent.some((a: any) => String(a.action).includes('sync'))
      if (hasSyncActivity && !isPollingRef.current) {
        isPollingRef.current = true
        scheduleTick()
      } else if (!hasSyncActivity && isPollingRef.current) {
        // stop polling when idle
        clearTick()
      }
    } catch (err) {
      console.error('Error fetching dashboard stats:', err)
      setError('Failed to load dashboard stats')
      backoffRef.current = Math.min(backoffRef.current * 2, 20000)
    } finally {
      setLoading(false)
    }
  }

  const scheduleTick = () => {
    clearTick()
    const tick = async () => {
      if (document.hidden) {
        intervalRef.current = setTimeout(tick, 1500) as any
        return
      }
      await fetchStats()
      intervalRef.current = setTimeout(tick, backoffRef.current) as any
    }
    intervalRef.current = setTimeout(tick, backoffRef.current) as any
  }

  const clearTick = () => {
    if (intervalRef.current) clearTimeout(intervalRef.current as any)
    intervalRef.current = null
    isPollingRef.current = false
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getActivityIcon = (action: string) => {
    switch (action) {
      case 'supplier_created':
        return (
          <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
          </svg>
        )
      case 'sync_completed':
        return (
          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )
      case 'export_generated':
        return (
          <svg className="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        )
      default:
        return (
          <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
        )
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white p-6 rounded-lg shadow animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error}</p>
        <button
          onClick={fetchStats}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    )
  }

  if (!stats) {
    return null
  }

  return (
    <div className="space-y-6 dashboard-stats">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 dashboard-stats-cards">
        <div className="bg-white p-6 rounded-lg shadow dashboard-stats-card dashboard-stats-card-suppliers">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Suppliers</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.total_suppliers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow dashboard-stats-card dashboard-stats-card-products">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Products</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.total_products.toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow dashboard-stats-card dashboard-stats-card-exports">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Exports</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.total_exports}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow dashboard-stats-card dashboard-stats-card-active">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Workspaces</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.total_workspaces ?? 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Supplier Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 dashboard-status-and-activity">
        <div className="bg-white p-6 rounded-lg shadow supplier-status-card">
          <h3 className="text-lg font-medium text-gray-900 mb-4 supplier-status-title">Supplier Status</h3>
          <div className="space-y-4 supplier-status-list">
            <div className="flex items-center justify-between supplier-status-item supplier-status-item-active">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm text-gray-600">Active</span>
              </div>
              <span className="text-sm font-medium text-gray-900">{stats.active_suppliers}</span>
            </div>
            {typeof stats.draft_suppliers === 'number' && (
              <div className="flex items-center justify-between supplier-status-item supplier-status-item-draft">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-gray-400 rounded-full mr-3"></div>
                  <span className="text-sm text-gray-600">Draft</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{stats.draft_suppliers}</span>
              </div>
            )}
            {typeof stats.paused_suppliers === 'number' && (
              <div className="flex items-center justify-between supplier-status-item supplier-status-item-paused">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-amber-400 rounded-full mr-3"></div>
                  <span className="text-sm text-gray-600">Paused</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{stats.paused_suppliers}</span>
              </div>
            )}
            <div className="flex items-center justify-between supplier-status-item supplier-status-item-errors">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-3"></div>
                <span className="text-sm text-gray-600">Errors</span>
              </div>
              <span className="text-sm font-medium text-gray-900">{stats.error_suppliers}</span>
            </div>
            {stats.last_sync_at && (
              <div className="pt-4 border-t supplier-status-last-sync">
                <p className="text-sm text-gray-600">
                  Last sync: {formatDate(stats.last_sync_at)}
                </p>
              </div>
            )}
          </div>
        </div>

        <DashboardInsights />
      </div>
    </div>
  )
}