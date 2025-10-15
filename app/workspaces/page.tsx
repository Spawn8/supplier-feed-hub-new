'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabaseClient'
import WorkspaceList from '@/components/WorkspaceList'
import WorkspaceFormModal from '@/components/WorkspaceFormModal'

export default function WorkspacesPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const router = useRouter()

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

  const handleWorkspaceSelect = (workspaceId: string) => {
    router.push('/dashboard')
  }

  const handleCreateSuccess = (workspace: any) => {
    // Switch to the new workspace
    handleWorkspaceSelect(workspace.id)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="workspaces-page min-h-screen bg-gray-50">
      <div className="workspaces-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="workspaces-header text-center mb-8">
          <h1 className="workspaces-title text-3xl font-bold text-gray-900">Your Workspaces</h1>
          <p className="workspaces-subtitle mt-2 text-lg text-gray-600">
            Manage your supplier feed workspaces
          </p>
        </div>

        <div className="workspaces-content">
          <WorkspaceList
            onWorkspaceSelect={handleWorkspaceSelect}
            onCreateWorkspace={() => setShowCreateModal(true)}
          />
        </div>

        <WorkspaceFormModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      </div>
    </div>
  )
}