'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabaseClient'
import { useWorkspace } from '@/lib/workspaceContext'
import SupplierWizard from '@/components/SupplierWizard'

export default function NewSupplierPage() {
  const { activeWorkspaceId } = useWorkspace()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
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

  const handleSuccess = (supplier: any) => {
    router.push(`/suppliers/${supplier.id}/raw`)
  }

  const handleCancel = () => {
    router.push('/suppliers')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" suppressHydrationWarning={true}>
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600" suppressHydrationWarning={true}></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (!activeWorkspaceId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" suppressHydrationWarning={true}>
        <div className="text-center" suppressHydrationWarning={true}>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">No Workspace Selected</h2>
          <p className="text-gray-600 mb-4">Please select a workspace to add suppliers.</p>
          <button
            onClick={() => router.push('/workspaces')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Workspaces
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50" suppressHydrationWarning={true}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" suppressHydrationWarning={true}>
        <div className="mb-8" suppressHydrationWarning={true}>
          <h1 className="text-3xl font-bold text-gray-900">Add New Supplier</h1>
          <p className="mt-2 text-lg text-gray-600">
            Connect a new supplier feed to start importing products
          </p>
        </div>

        <div className="bg-white shadow rounded-lg" suppressHydrationWarning={true}>
          <div className="px-4 py-5 sm:p-6" suppressHydrationWarning={true}>
            <SupplierWizard 
              onSuccess={handleSuccess}
              onCancel={handleCancel}
            />
          </div>
        </div>
      </div>
    </div>
  )
}