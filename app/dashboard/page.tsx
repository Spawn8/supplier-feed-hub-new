'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabaseClient'
import { useWorkspace } from '@/lib/workspaceContext'
import DashboardStats from '@/components/DashboardStats'
import DashboardCharts from '@/components/DashboardCharts'
import QuickActions from '@/components/QuickActions'
import RecentActivity from '@/components/RecentActivity'

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const { activeWorkspaceId, isWorkspaceReady } = useWorkspace()

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    try {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      setUser(user)
    } catch (error) {
      console.error('Error checking user:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const handleAction = (action: string) => {
    switch (action) {
      case 'sync_all':
        // Already handled in QuickActions component
        break
      default:
        console.log('Unknown action:', action)
    }
  }

  if (loading || !isWorkspaceReady || !activeWorkspaceId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {!isWorkspaceReady ? 'Setting up workspace...' : 'Loading dashboard...'}
          </p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="dashboard-page min-h-screen bg-gray-50">
      <div className="dashboard-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="dashboard-header mb-8 flex items-start justify-between">
          <div>
            <h1 className="dashboard-title text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="dashboard-subtitle mt-2 text-lg text-gray-600">
              Overview of your supplier feed management
            </p>
          </div>
          <button
            onClick={() => {
              // ask children to refresh by reloading the route's data subtly
              // we'll rely on components' own fetch to re-run
              window.dispatchEvent(new CustomEvent('dashboard:refresh'))
            }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 shadow-sm"
            aria-label="Refresh dashboard"
            title="Refresh"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-sm font-medium">Refresh</span>
          </button>
        </div>

        <div className="dashboard-content space-y-8">
          {/* Stats */}
          <div className="dashboard-stats-section">
            <DashboardStats />
          </div>

          {/* Quick Actions */}
          <div className="dashboard-actions-section">
            <QuickActions onAction={handleAction} />
          </div>

          {/* Charts and Activity */}
          <div className="dashboard-charts-activity grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="dashboard-charts-container">
              <DashboardCharts />
            </div>
            <div className="dashboard-activity-container" id="recent-activity">
              <RecentActivity />
            </div>
          </div>

          
        </div>
      </div>
    </div>
  )
}