'use client'

import { useState, useEffect } from 'react'

interface WooCommerceConfig {
  store_url: string
  consumer_key: string
  consumer_secret: string
  is_connected: boolean
}

export default function WooCommerceSetup() {
  const [config, setConfig] = useState<WooCommerceConfig>({
    store_url: '',
    consumer_key: '',
    consumer_secret: '',
    is_connected: false
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchConfig()
  }, [])

  const fetchConfig = async () => {
    try {
      const response = await fetch('/api/integrations/woocommerce/config', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const data = await response.json()
        setConfig(data.config)
      }
    } catch (error) {
      console.error('Error fetching WooCommerce config:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/integrations/woocommerce/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save configuration')
      }

      setSuccess('WooCommerce configuration saved successfully')
      setConfig(prev => ({ ...prev, is_connected: true }))
    } catch (err) {
      console.error('Error saving WooCommerce config:', err)
      setError(err instanceof Error ? err.message : 'Failed to save configuration')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setConfig(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const testConnection = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/integrations/woocommerce/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Connection test failed')
      }

      setSuccess('Connection successful! WooCommerce store is accessible.')
    } catch (err) {
      console.error('Error testing connection:', err)
      setError(err instanceof Error ? err.message : 'Connection test failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">WooCommerce Store Configuration</h3>
          
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

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="store_url" className="block text-sm font-medium text-gray-700 mb-2">
                Store URL *
              </label>
              <input
                type="url"
                id="store_url"
                name="store_url"
                value={config.store_url}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://yourstore.com"
              />
              <p className="text-xs text-gray-500 mt-1">
                The URL of your WooCommerce store
              </p>
            </div>

            <div>
              <label htmlFor="consumer_key" className="block text-sm font-medium text-gray-700 mb-2">
                Consumer Key *
              </label>
              <input
                type="text"
                id="consumer_key"
                name="consumer_key"
                value={config.consumer_key}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="ck_..."
              />
              <p className="text-xs text-gray-500 mt-1">
                WooCommerce API Consumer Key
              </p>
            </div>

            <div>
              <label htmlFor="consumer_secret" className="block text-sm font-medium text-gray-700 mb-2">
                Consumer Secret *
              </label>
              <input
                type="password"
                id="consumer_secret"
                name="consumer_secret"
                value={config.consumer_secret}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="cs_..."
              />
              <p className="text-xs text-gray-500 mt-1">
                WooCommerce API Consumer Secret
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <button
                type="button"
                onClick={testConnection}
                disabled={loading || !config.store_url || !config.consumer_key || !config.consumer_secret}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Test Connection
              </button>
              <button
                type="submit"
                disabled={loading || !config.store_url || !config.consumer_key || !config.consumer_secret}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-800 mb-2">How to get your API credentials:</h4>
        <ol className="text-sm text-blue-700 space-y-1">
          <li>1. Go to your WooCommerce store admin</li>
          <li>2. Navigate to WooCommerce → Settings → Advanced → REST API</li>
          <li>3. Click "Add Key" to create a new API key</li>
          <li>4. Set permissions to "Read/Write"</li>
          <li>5. Copy the Consumer Key and Consumer Secret</li>
        </ol>
      </div>
    </div>
  )
}