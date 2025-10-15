'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabaseClient'
import ExportsList from '@/components/ExportsList'

export default function ExportsPage() {
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

  const handleExportSelect = (exportProfile: any) => {
    // TODO: Navigate to export profile edit page
    console.log('Selected export profile:', exportProfile)
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
    <div className="exports-page min-h-screen bg-gray-50">
      <div className="exports-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="exports-header mb-8">
          <h1 className="exports-title text-3xl font-bold text-gray-900">Exports</h1>
          <p className="exports-subtitle mt-2 text-lg text-gray-600">
            Create and manage export profiles for your product data
          </p>
        </div>

        <div className="exports-content">
          <ExportsList onExportSelect={handleExportSelect} />
        </div>
      </div>
    </div>
  )
}