'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useWorkspace } from '@/lib/workspaceContext'

interface WorkspaceStats {
  suppliers: number
  fields: number
  exports: number
}

interface WorkspaceWithStats {
  id: string
  name: string
  slug: string
  description?: string
  logo_url?: string
  created_at: string
  updated_at: string
  user_role: string
  stats?: WorkspaceStats
}

export default function WorkspaceSelector() {
  const { activeWorkspaceId, setActiveWorkspaceId, workspaces, setWorkspaces } = useWorkspace()
  const [isOpen, setIsOpen] = useState(false)
  const [workspacesWithStats, setWorkspacesWithStats] = useState<WorkspaceWithStats[]>([])
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Auto-select workspace if only one exists
  useEffect(() => {
    if (workspaces.length === 1 && !activeWorkspaceId) {
      setActiveWorkspaceId(workspaces[0].id)
    }
  }, [workspaces, activeWorkspaceId, setActiveWorkspaceId])

  // Fetch stats only for the active workspace to avoid N calls
  useEffect(() => {
    const fetchActiveWorkspaceStats = async () => {
      if (!activeWorkspaceId || workspaces.length === 0) {
        setWorkspacesWithStats(workspaces)
        return
      }

      setLoading(true)
      try {
        const response = await fetch(`/api/workspaces/${activeWorkspaceId}/stats`)
        let activeStats: any = null
        if (response.ok) {
          const data = await response.json()
          activeStats = data.stats
        }

        const merged = workspaces.map(ws => ws.id === activeWorkspaceId ? { ...ws, stats: activeStats } : ws)
        setWorkspacesWithStats(merged)
      } catch (error) {
        console.error('Error fetching active workspace stats:', error)
        setWorkspacesWithStats(workspaces)
      } finally {
        setLoading(false)
      }
    }

    fetchActiveWorkspaceStats()
  }, [activeWorkspaceId, workspaces])

  // Handle click away to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleWorkspaceSelect = async (workspaceId: string) => {
    try {
      const response = await fetch('/api/switch-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId }),
      })

      if (response.ok) {
        setActiveWorkspaceId(workspaceId)
        setIsOpen(false)
        router.refresh()
      }
    } catch (error) {
      console.error('Error switching workspace:', error)
    }
  }

  const getActiveWorkspace = () => {
    return workspacesWithStats.find(w => w.id === activeWorkspaceId) || workspacesWithStats[0]
  }

  const activeWorkspace = getActiveWorkspace()

  if (workspaces.length === 0) {
    return (
      <div className="w-full">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 mb-3">No workspaces yet</p>
          <button
            onClick={() => router.push('/workspaces')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Create Workspace
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={dropdownRef} className="workspace-selector-container w-full relative" suppressHydrationWarning={true}>
      {/* Selected Workspace Display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="workspace-selector-button w-full flex items-center justify-between p-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-left"
      >
        <div className="workspace-selector-content flex items-center space-x-3 flex-1 min-w-0">
          {activeWorkspace?.logo_url ? (
            <img
              src={activeWorkspace.logo_url}
              alt={activeWorkspace.name}
              className="workspace-selector-logo w-10 h-10 rounded-lg object-cover flex-shrink-0"
            />
          ) : (
            <div className="workspace-selector-avatar w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="workspace-selector-avatar-text text-blue-600 font-semibold text-sm">
                {activeWorkspace?.name?.charAt(0).toUpperCase() || 'W'}
              </span>
            </div>
          )}
          <div className="workspace-selector-info flex-1 min-w-0">
            <p className="workspace-selector-name text-sm font-medium text-gray-900 truncate">
              {activeWorkspace?.name || 'Select workspace'}
            </p>
          </div>
        </div>
        <svg 
          className={`workspace-selector-arrow w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="workspace-selector-dropdown absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-[9999] max-h-80 overflow-y-auto w-80 min-w-80">
          {workspacesWithStats.map((workspace) => (
            <button
              key={workspace.id}
              onClick={() => handleWorkspaceSelect(workspace.id)}
              className={`workspace-dropdown-item w-full flex items-center space-x-3 p-3 hover:bg-gray-50 transition-colors ${
                activeWorkspaceId === workspace.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
              }`}
            >
              {workspace.logo_url ? (
                <img
                  src={workspace.logo_url}
                  alt={workspace.name}
                  className="workspace-dropdown-logo w-10 h-10 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="workspace-dropdown-avatar w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="workspace-dropdown-avatar-text text-gray-600 font-semibold text-sm">
                    {workspace.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="workspace-dropdown-info flex-1 min-w-0 text-left">
                <p className="workspace-dropdown-name text-sm font-medium text-gray-900 truncate text-left">
                  {workspace.name}
                </p>
                {workspace.stats && (
                  <p className="workspace-dropdown-stats text-xs text-gray-500 whitespace-nowrap text-left">
                    {workspace.stats.suppliers} suppliers • {workspace.stats.fields} fields • {workspace.stats.exports} exports
                  </p>
                )}
                {workspace.description && (
                  <p className="workspace-dropdown-description text-xs text-gray-400 truncate mt-1 text-left">
                    {workspace.description}
                  </p>
                )}
              </div>
              {activeWorkspaceId === workspace.id && (
                <div className="workspace-dropdown-indicator w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
              )}
            </button>
          ))}
          
          {/* Manage Workspaces Link */}
          <div className="workspace-dropdown-footer border-t border-gray-200 p-2">
            <button
              onClick={() => {
                setIsOpen(false)
                router.push('/workspaces')
              }}
              className="workspace-dropdown-manage-button w-full flex items-center space-x-3 p-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <div className="workspace-dropdown-manage-icon w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <span className="workspace-dropdown-manage-text">Manage workspaces</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
