'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabaseClient'
import WooCommerceSetup from '@/components/WooCommerceSetup'
import WooCommerceSync from '@/components/WooCommerceSync'

export default function WooCommercePage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'setup' | 'sync'>('setup')
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">WooCommerce Integration</h1>
          <p className="mt-2 text-lg text-gray-600">
            Connect your supplier feeds to WooCommerce stores
          </p>
        </div>

        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('setup')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'setup'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Setup
              </button>
              <button
                onClick={() => setActiveTab('sync')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'sync'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Sync
              </button>
            </nav>
          </div>
        </div>

        {activeTab === 'setup' ? (
          <WooCommerceSetup />
        ) : (
          <WooCommerceSync />
        )}
      </div>
    </div>
  )
}