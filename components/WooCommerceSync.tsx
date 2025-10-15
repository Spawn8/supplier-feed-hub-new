'use client'

import { useState, useEffect } from 'react'

interface SyncStatus {
  is_running: boolean
  last_sync_at?: string
  products_synced: number
  products_created: number
  products_updated: number
  products_skipped: number
  errors: string[]
}

export default function WooCommerceSync() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    is_running: false,
    products_synced: 0,
    products_created: 0,
    products_updated: 0,
    products_skipped: 0,
    errors: []
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchSyncStatus()
  }, [])

  const fetchSyncStatus = async () => {
    try {
      const response = await fetch('/api/integrations/woocommerce/sync/status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        setSyncStatus(data.status)
      }
    } catch (error) {
      console.error('Error fetching sync status:', error)
    }
  }

  const startSync = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/integrations/woocommerce/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start sync')
      }

      setSuccess('Sync started successfully')
      setSyncStatus(prev => ({ ...prev, is_running: true }))
      
      // Poll for updates
      pollSyncStatus()
    } catch (err) {
      console.error('Error starting sync:', err)
      setError(err instanceof Error ? err.message : 'Failed to start sync')
    } finally {
      setLoading(false)
    }
  }

  const pollSyncStatus = async () => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch('/api/integrations/woocommerce/sync/status', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (response.ok) {
          const data = await response.json()
          setSyncStatus(data.status)
          
          if (!data.status.is_running) {
            clearInterval(interval)
          }
        }
      } catch (error) {
        console.error('Error polling sync status:', error)
        clearInterval(interval)
      }
    }, 2000)

    // Stop polling after 5 minutes
    setTimeout(() => {
      clearInterval(interval)
    }, 300000)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Sync Products to WooCommerce</h3>
          
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-green-600">{success}</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Product Sync</h4>
                <p className="text-sm text-gray-500">
                  Sync your mapped products to WooCommerce
                </p>
              </div>
              <button
                onClick={startSync}
                disabled={loading || syncStatus.is_running}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Starting...' : syncStatus.is_running ? 'Syncing...' : 'Start Sync'}
              </button>
            </div>

            {syncStatus.last_sync_at && (
              <div className="text-sm text-gray-600">
                Last sync: {formatDate(syncStatus.last_sync_at)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sync Status */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Sync Status</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{syncStatus.products_synced}</div>
              <div className="text-sm text-blue-800">Total Synced</div>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{syncStatus.products_created}</div>
              <div className="text-sm text-green-800">Created</div>
            </div>
            
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{syncStatus.products_updated}</div>
              <div className="text-sm text-yellow-800">Updated</div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">{syncStatus.products_skipped}</div>
              <div className="text-sm text-gray-800">Skipped</div>
            </div>
          </div>

          {syncStatus.errors.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium text-red-800 mb-2">Errors:</h4>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <ul className="text-sm text-red-700 space-y-1">
                  {syncStatus.errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sync Settings */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Sync Settings</h3>
          
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="update_existing"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                defaultChecked
              />
              <label htmlFor="update_existing" className="ml-2 text-sm text-gray-700">
                Update existing products
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="create_new"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                defaultChecked
              />
              <label htmlFor="create_new" className="ml-2 text-sm text-gray-700">
                Create new products
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="sync_images"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                defaultChecked
              />
              <label htmlFor="sync_images" className="ml-2 text-sm text-gray-700">
                Sync product images
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}