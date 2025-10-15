'use client'

import { useEffect, useRef } from 'react'

interface Workspace {
  id: string
  name: string
  slug: string
  description?: string
  created_at: string
  updated_at: string
  user_role: string
}

interface WorkspaceFetcherProps {
  onWorkspacesLoaded: (workspaces: Workspace[]) => void
}

export default function WorkspaceFetcher({ onWorkspacesLoaded }: WorkspaceFetcherProps) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const fetchWorkspaces = async () => {
      try {
        const response = await fetch('/api/workspaces', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (response.ok) {
          const data = await response.json()
          onWorkspacesLoaded(data.workspaces || [])
        } else {
          console.error('Failed to fetch workspaces:', response.statusText)
          onWorkspacesLoaded([])
        }
      } catch (error) {
        console.error('Error fetching workspaces:', error)
        onWorkspacesLoaded([])
      }
    }

    // Initial fetch
    fetchWorkspaces()

    // Set up polling to keep workspaces in sync (reduced frequency)
    intervalRef.current = setInterval(fetchWorkspaces, 60000) // Poll every 60 seconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [onWorkspacesLoaded])

  return null // This component doesn't render anything
}
