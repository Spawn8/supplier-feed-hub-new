'use client'

import { useState } from 'react'
import { useWorkspace } from '@/lib/workspaceContext'

interface SupplierFormProps {
  onSuccess: (supplier: any) => void
  onCancel: () => void
}

export default function SupplierForm({ onSuccess, onCancel }: SupplierFormProps) {
  const { activeWorkspaceId } = useWorkspace()
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    source_type: 'url',
    endpoint_url: '',
    auth_username: '',
    auth_password: '',
    schedule_cron: '',
    schedule_enabled: false
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!activeWorkspaceId) {
      setError('No workspace selected')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/suppliers/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          workspace_id: activeWorkspaceId
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create supplier')
      }

      onSuccess(data.supplier)
    } catch (err) {
      console.error('Error creating supplier:', err)
      setError(err instanceof Error ? err.message : 'Failed to create supplier')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }))
  }

  const commonCronExpressions = [
    { value: '', label: 'Manual only' },
    { value: '0 */1 * * *', label: 'Every hour' },
    { value: '0 0 */6 * *', label: 'Every 6 hours' },
    { value: '0 0 */12 * *', label: 'Every 12 hours' },
    { value: '0 0 * * *', label: 'Daily at midnight' },
    { value: '0 0 3 * *', label: 'Daily at 3:00 AM' },
    { value: '0 0 * * 0', label: 'Weekly on Sunday' },
    { value: '0 0 1 * *', label: 'Monthly on 1st' }
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Supplier Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="My Supplier"
          />
        </div>

        <div>
          <label htmlFor="source_type" className="block text-sm font-medium text-gray-700 mb-2">
            Source Type *
          </label>
          <select
            id="source_type"
            name="source_type"
            value={formData.source_type}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="url">URL Feed</option>
            <option value="upload">File Upload</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Brief description of this supplier..."
        />
      </div>

      {formData.source_type === 'url' && (
        <>
          <div>
            <label htmlFor="endpoint_url" className="block text-sm font-medium text-gray-700 mb-2">
              Endpoint URL *
            </label>
            <input
              type="url"
              id="endpoint_url"
              name="endpoint_url"
              value={formData.endpoint_url}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://example.com/products.xml"
            />
            <p className="text-xs text-gray-500 mt-1">
              URL to your product feed (XML, CSV, or JSON)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="auth_username" className="block text-sm font-medium text-gray-700 mb-2">
                Username (Optional)
              </label>
              <input
                type="text"
                id="auth_username"
                name="auth_username"
                value={formData.auth_username}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="username"
              />
            </div>

            <div>
              <label htmlFor="auth_password" className="block text-sm font-medium text-gray-700 mb-2">
                Password (Optional)
              </label>
              <input
                type="password"
                id="auth_password"
                name="auth_password"
                value={formData.auth_password}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="••••••••"
              />
            </div>
          </div>
        </>
      )}

      {formData.source_type === 'upload' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-blue-700">
              File upload functionality will be available after creating the supplier.
            </p>
          </div>
        </div>
      )}

      <div className="border-t pt-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Scheduling</h3>
        
        <div className="flex items-center mb-4">
          <input
            type="checkbox"
            id="schedule_enabled"
            name="schedule_enabled"
            checked={formData.schedule_enabled}
            onChange={handleChange}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label htmlFor="schedule_enabled" className="ml-2 text-sm text-gray-700">
            Enable automatic syncing
          </label>
        </div>

        {formData.schedule_enabled && (
          <div>
            <label htmlFor="schedule_cron" className="block text-sm font-medium text-gray-700 mb-2">
              Sync Frequency
            </label>
            <select
              id="schedule_cron"
              name="schedule_cron"
              value={formData.schedule_cron}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {commonCronExpressions.map((expr) => (
                <option key={expr.value} value={expr.value}>
                  {expr.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Choose how often to sync this supplier's data
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end space-x-3 pt-6 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !formData.name.trim() || (formData.source_type === 'url' && !formData.endpoint_url.trim())}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Creating Supplier...' : 'Create Supplier'}
        </button>
      </div>
    </form>
  )
}
