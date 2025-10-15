'use client'

import { useState, useEffect, useRef } from 'react'
import { useWorkspace } from '@/lib/workspaceContext'

interface ActivityItem {
  id: string
  action: string
  resource_type: string
  resource_name: string
  user_name?: string
  created_at: string
  details?: Record<string, any>
}

interface RecentActivityProps {
  limit?: number
  className?: string
}

export default function RecentActivity({ limit = 8, className = '' }: RecentActivityProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const snapshotRef = useRef<string>('')
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const backoffRef = useRef<number>(4000)
  const { activeWorkspaceId, isWorkspaceReady } = useWorkspace()

  useEffect(() => {
    if (isWorkspaceReady && activeWorkspaceId) {
      fetchActivities()
    }
  }, [limit, isWorkspaceReady, activeWorkspaceId])

  // Manual refresh trigger from dashboard page
  useEffect(() => {
    const handler = () => fetchActivities()
    window.addEventListener('dashboard:refresh', handler as any)
    return () => window.removeEventListener('dashboard:refresh', handler as any)
  }, [])

  // Do not force-refresh on focus; keep view stable and resume checks

  const fetchActivities = async (retryCount = 0) => {
    try {
      setLoading(true)
      const response = await fetch(`/api/activity?limit=${limit}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        // If it's a workspace error and we haven't retried too many times, retry after a delay
        if (data.error === 'No workspace selected' && retryCount < 3) {
          console.log(`Retrying activities fetch (attempt ${retryCount + 1})`)
          setTimeout(() => {
            fetchActivities(retryCount + 1)
          }, 500)
          return
        }
        throw new Error(data.error || 'Failed to load activities')
      }

      const slice = (data.activities || []).slice(0, limit)
      const snapshot = JSON.stringify(slice.map((a: any) => a.id))
      if (snapshot !== snapshotRef.current) {
        snapshotRef.current = snapshot
        setActivities(slice)
      }
      setError(null)
      backoffRef.current = 4000
    } catch (err) {
      console.error('Error fetching activities:', err)
      setError('Failed to load activities')
      backoffRef.current = Math.min(backoffRef.current * 2, 20000)
    } finally {
      setLoading(false)
    }
  }

  const getActivityIcon = (action: string) => {
    switch (action) {
      case 'supplier_created':
        return (
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        )
      case 'supplier_updated':
        return (
          <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 01-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
          </div>
        )
      case 'sync_completed':
        return (
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
        )
      case 'export_generated':
        return (
          <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          </div>
        )
      case 'field_created':
        return (
          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
          </div>
        )
      default:
        return (
          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
            </svg>
          </div>
        )
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return `${Math.floor(diffInMinutes / 1440)}d ago`
  }

  const getActionText = (action: string) => {
    const actionMap: Record<string, string> = {
      'supplier_created': 'created supplier',
      'supplier_updated': 'updated supplier',
      'supplier_deleted': 'deleted supplier',
      'sync_completed': 'completed sync',
      'sync_failed': 'sync failed',
      'export_generated': 'generated export',
      'field_created': 'created field',
      'field_updated': 'updated field',
      'field_deleted': 'deleted field',
      'workspace_created': 'created workspace',
      'workspace_updated': 'updated workspace'
    }
    return actionMap[action] || action.replace(/_/g, ' ')
  }

  if (loading) {
    return (
      <div className={`bg-white p-6 rounded-lg shadow ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-1"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-white p-6 rounded-lg shadow ${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchActivities}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white p-6 rounded-lg shadow dashboard-recent-activity ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900 dashboard-recent-activity-title">Recent Activity</h3>
        <button
          onClick={fetchActivities}
          className="text-sm text-gray-500 hover:text-gray-700 dashboard-recent-activity-refresh"
        >
          Refresh
        </button>
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-8">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-gray-500">No recent activity</p>
        </div>
      ) : (
        <div className="space-y-4 dashboard-recent-activity-list">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start space-x-3 dashboard-recent-activity-item">
              {getActivityIcon(activity.action)}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900">
                  <span className="font-medium">{getActionText(activity.action)}</span>
                  {activity.resource_name && (
                    <span className="text-gray-600"> • {activity.resource_name}</span>
                  )}
                </p>
                <div className="flex items-center space-x-2 mt-1">
                  <p className="text-xs text-gray-500">
                    {formatTime(activity.created_at)}
                  </p>
                  {activity.user_name && (
                    <>
                      <span className="text-xs text-gray-400">•</span>
                      <p className="text-xs text-gray-500">
                        by {activity.user_name}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}