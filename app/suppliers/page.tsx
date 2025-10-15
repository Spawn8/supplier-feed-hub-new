'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabaseClient'
import SuppliersList from '@/components/SuppliersList'
import SkeletonLoader from '@/components/ui/SkeletonLoader'

export default function SuppliersPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    setMounted(true)
    checkUser()
    
    // Check for success message from field mapping save
    const mappingSaved = searchParams.get('mapping_saved')
    const supplierName = searchParams.get('supplier_name')
    const syncNeeded = searchParams.get('sync_needed')
    
    if (mappingSaved === 'true' && supplierName) {
      const decodedName = decodeURIComponent(supplierName)
      const syncMessage = syncNeeded === 'true' ? ' Sync is needed due to mapping changes.' : ''
      setSuccessMessage(`Field mappings for "${decodedName}" saved successfully!${syncMessage}`)
      setShowSuccessMessage(true)
      
      // Clean up URL parameters without triggering a reload
      const url = new URL(window.location.href)
      url.searchParams.delete('mapping_saved')
      url.searchParams.delete('supplier_name')
      url.searchParams.delete('sync_needed')
      window.history.replaceState({}, '', url.toString())
    }
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


  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return <SkeletonLoader type="page" />
  }

  if (loading) {
    return <SkeletonLoader type="page" />
  }

  if (!user) {
    return null
  }

  return (
    <div className="suppliers-page min-h-screen bg-gray-50">
      <div className="suppliers-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success Message */}
        {showSuccessMessage && (
          <div className="suppliers-success-message mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="suppliers-success-content flex items-start">
              <div className="suppliers-success-icon flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="suppliers-success-text ml-3 flex-1">
                <p className="text-sm font-medium text-green-800">
                  {successMessage}
                </p>
              </div>
              <div className="suppliers-success-close ml-auto pl-3">
                <div className="-mx-1.5 -my-1.5">
                  <button
                    onClick={() => setShowSuccessMessage(false)}
                    className="suppliers-success-dismiss inline-flex bg-green-50 rounded-md p-1.5 text-green-500 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-green-50 focus:ring-green-600"
                  >
                    <span className="sr-only">Dismiss</span>
                    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="suppliers-header mb-8">
          <h1 className="suppliers-title text-3xl font-bold text-gray-900">Suppliers</h1>
          <p className="suppliers-subtitle mt-2 text-lg text-gray-600">
            Manage your supplier feeds and data sources
          </p>
        </div>

        <div className="suppliers-content">
          <SuppliersList />
        </div>
      </div>
    </div>
  )
}