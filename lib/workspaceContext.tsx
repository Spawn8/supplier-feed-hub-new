'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

interface Workspace {
  id: string
  name: string
  slug: string
  description?: string
  created_at: string
  updated_at: string
  user_role: string
}

interface WorkspaceContextType {
  activeWorkspaceId: string | null
  setActiveWorkspaceId: (id: string | null) => void
  workspaces: Workspace[]
  setWorkspaces: (workspaces: Workspace[]) => void
  isWorkspaceReady: boolean
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [isWorkspaceReady, setIsWorkspaceReady] = useState(false)

  // Load active workspace from localStorage on mount
  useEffect(() => {
    const savedWorkspaceId = localStorage.getItem('activeWorkspaceId')
    if (savedWorkspaceId) {
      setActiveWorkspaceIdState(savedWorkspaceId)
      // Also set the server-side cookie
      fetch('/api/switch-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: savedWorkspaceId }),
      }).then(() => {
        // Add a small delay to ensure cookie is set before marking as ready
        setTimeout(() => {
          setIsWorkspaceReady(true)
        }, 100)
      }).catch(error => {
        console.error('Error setting workspace cookie:', error)
        setIsWorkspaceReady(true) // Still mark as ready even if there's an error
      })
    } else {
      setIsWorkspaceReady(true) // No saved workspace, ready to auto-select
    }
  }, [])

  // Auto-select workspace when workspaces are loaded
  useEffect(() => {
    if (workspaces.length > 0 && !activeWorkspaceId) {
      let selectedWorkspaceId: string
      
      // If there's only one workspace, auto-select it
      if (workspaces.length === 1) {
        selectedWorkspaceId = workspaces[0].id
      }
      // If there are multiple workspaces, try to restore from localStorage
      else {
        const savedWorkspaceId = localStorage.getItem('activeWorkspaceId')
        if (savedWorkspaceId && workspaces.find(w => w.id === savedWorkspaceId)) {
          selectedWorkspaceId = savedWorkspaceId
        } else {
          // If saved workspace doesn't exist, select the first one
          selectedWorkspaceId = workspaces[0].id
        }
      }
      
      // Set the workspace in state and localStorage
      setActiveWorkspaceIdState(selectedWorkspaceId)
      localStorage.setItem('activeWorkspaceId', selectedWorkspaceId)
      
      // Also set the server-side cookie by calling the switch-workspace API
      fetch('/api/switch-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: selectedWorkspaceId }),
      }).then(() => {
        // Add a small delay to ensure cookie is set before marking as ready
        setTimeout(() => {
          setIsWorkspaceReady(true)
        }, 100)
      }).catch(error => {
        console.error('Error setting workspace cookie:', error)
        setIsWorkspaceReady(true) // Still mark as ready even if there's an error
      })
    }
  }, [workspaces, activeWorkspaceId])

  // Save active workspace to localStorage when it changes
  const setActiveWorkspaceId = (id: string | null) => {
    setActiveWorkspaceIdState(id)
    if (id) {
      localStorage.setItem('activeWorkspaceId', id)
      // Also set the server-side cookie
      fetch('/api/switch-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: id }),
      }).then(() => {
        // Add a small delay to ensure cookie is set before marking as ready
        setTimeout(() => {
          setIsWorkspaceReady(true)
        }, 100)
      }).catch(error => {
        console.error('Error setting workspace cookie:', error)
        setIsWorkspaceReady(true) // Still mark as ready even if there's an error
      })
    } else {
      localStorage.removeItem('activeWorkspaceId')
      setIsWorkspaceReady(true)
    }
  }

  return (
    <WorkspaceContext.Provider value={{
      activeWorkspaceId,
      setActiveWorkspaceId,
      workspaces,
      setWorkspaces,
      isWorkspaceReady
    }}>
      <div suppressHydrationWarning={true}>
        {children}
      </div>
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider')
  }
  return context
}
