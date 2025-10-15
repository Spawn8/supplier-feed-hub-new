'use client'

import { useState, useEffect } from 'react'
import WorkspaceEditModal from './WorkspaceEditModal'
import { useWorkspace } from '@/lib/workspaceContext'

interface Workspace {
  id: string
  name: string
  slug: string
  description?: string
  logo_url?: string
  default_currency: string
  default_language: string
  timezone: string
  billing_plan: string
  billing_status: string
  created_at: string
  updated_at: string
  user_role: string
}

interface WorkspaceListProps {
  currentWorkspaceId?: string
  onWorkspaceSelect: (workspaceId: string) => void
  onCreateWorkspace: () => void
}

export default function WorkspaceList({ 
  currentWorkspaceId, 
  onWorkspaceSelect, 
  onCreateWorkspace 
}: WorkspaceListProps) {
  const { workspaces, setWorkspaces, activeWorkspaceId, setActiveWorkspaceId } = useWorkspace()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null)

  useEffect(() => {
    fetchWorkspaces()
  }, [])

  const fetchWorkspaces = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/workspaces', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to load workspaces`)
      }

      const data = await response.json()
      setWorkspaces(data.workspaces || [])
    } catch (err) {
      console.error('Error fetching workspaces:', err)
      setError(err instanceof Error ? err.message : 'Failed to load workspaces')
    } finally {
      setLoading(false)
    }
  }

  const switchWorkspace = async (workspaceId: string) => {
    try {
      const response = await fetch('/api/switch-workspace', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ workspace_id: workspaceId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to switch workspace')
      }

      onWorkspaceSelect(workspaceId)
    } catch (err) {
      console.error('Error switching workspace:', err)
      setError('Failed to switch workspace')
    }
  }

  const handleEditWorkspace = (workspace: Workspace) => {
    setEditingWorkspace(workspace)
    setShowEditModal(true)
  }

  const handleEditSuccess = (updatedWorkspace: Workspace) => {
    setWorkspaces(prev => 
      prev.map(ws => ws.id === updatedWorkspace.id ? updatedWorkspace : ws)
    )
    setShowEditModal(false)
    setEditingWorkspace(null)
  }

  const handleDeleteWorkspace = async (workspaceId: string) => {
    if (!confirm('Are you sure you want to delete this workspace? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete workspace')
      }

      setWorkspaces(prev => prev.filter(ws => ws.id !== workspaceId))
      
      // If the deleted workspace was active, clear the active workspace
      if (activeWorkspaceId === workspaceId) {
        setActiveWorkspaceId(null)
      }
    } catch (err) {
      console.error('Error deleting workspace:', err)
      setError('Failed to delete workspace')
    }
  }

  if (loading) {
    return (
      <div className="workspace-list-loading p-6">
        <div className="workspace-list-loading-content animate-pulse">
          <div className="workspace-list-loading-title h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="workspace-list-loading-items space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="workspace-list-loading-item h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="workspace-list-error p-6">
        <div className="workspace-list-error-message bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="workspace-list-error-text text-red-600">{error}</p>
          <button
            onClick={fetchWorkspaces}
            className="workspace-list-error-retry mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="workspace-list-container p-6">
      <div className="workspace-list-header flex items-center justify-between mb-6">
        <h2 className="workspace-list-title text-xl font-semibold text-gray-900">Your Workspaces</h2>
        <button
          onClick={onCreateWorkspace}
          className="workspace-list-create-button px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Create Workspace
        </button>
      </div>

      {workspaces.length === 0 ? (
        <div className="workspace-list-empty text-center py-12">
          <div className="workspace-list-empty-icon w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="workspace-list-empty-title text-lg font-medium text-gray-900 mb-2">No workspaces yet</h3>
          <p className="workspace-list-empty-description text-gray-500 mb-4">Create your first workspace to get started</p>
          <button
            onClick={onCreateWorkspace}
            className="workspace-list-empty-button px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Your First Workspace
          </button>
        </div>
      ) : (
        <div className="workspace-list-grid grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace) => (
            <div
              key={workspace.id}
              className={`workspace-card border rounded-lg p-4 transition-all hover:shadow-md bg-white ${
                currentWorkspaceId === workspace.id
                  ? 'border-blue-500'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="workspace-card-header flex items-start justify-between mb-3">
                <div 
                  className="workspace-card-content flex items-start space-x-3 flex-1 cursor-pointer"
                  onClick={() => switchWorkspace(workspace.id)}
                >
                  {workspace.logo_url ? (
                    <img
                      src={workspace.logo_url}
                      alt={workspace.name}
                      className="workspace-card-logo w-10 h-10 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="workspace-card-avatar w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <span className="workspace-card-avatar-text text-blue-600 font-semibold text-sm">
                        {workspace.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="workspace-card-info">
                    <h3 className="workspace-card-name font-medium text-gray-900">{workspace.name}</h3>
                    <p className="workspace-card-role text-sm text-gray-500 capitalize">{workspace.user_role}</p>
                  </div>
                </div>
                <div className="workspace-card-actions flex items-center space-x-1">
                  {currentWorkspaceId === workspace.id && (
                    <div className="workspace-card-indicator w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                  )}
                  <div className="workspace-card-buttons flex space-x-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEditWorkspace(workspace)
                      }}
                      className="workspace-card-edit-button p-1 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Edit workspace"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteWorkspace(workspace.id)
                      }}
                      className="workspace-card-delete-button p-1 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete workspace"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              
              {workspace.description && (
                <p className="workspace-card-description text-sm text-gray-600 mb-3 line-clamp-2">
                  {workspace.description}
                </p>
              )}
              
              <div className="workspace-card-footer flex items-center justify-between text-xs text-gray-500">
                <span className="workspace-card-plan capitalize">{workspace.billing_plan} Plan</span>
                <span className="workspace-card-currency">{workspace.default_currency}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <WorkspaceEditModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setEditingWorkspace(null)
        }}
        onSuccess={handleEditSuccess}
        workspace={editingWorkspace}
      />
    </div>
  )
}
