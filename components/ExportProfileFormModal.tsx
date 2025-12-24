'use client'

import { useState, useEffect } from 'react'
import Modal from './ui/Modal'
import { useWorkspace } from '@/lib/workspaceContext'

interface CustomField {
  id: string
  name: string
  key: string
}

interface ExportProfile {
  id: string
  name: string
  description?: string
  output_format: 'csv' | 'json' | 'xml'
  platform?: string
  field_selection: string[]
  field_ordering: string[]
  filters: Record<string, any>
  template_config: Record<string, any>
  file_naming: string
  delivery_method: 'download' | 'feed'
  delivery_config: Record<string, any>
  is_active: boolean
}

interface ExportProfileFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  profile?: ExportProfile
}

export default function ExportProfileFormModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  profile 
}: ExportProfileFormModalProps) {
  const { activeWorkspaceId } = useWorkspace()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fields, setFields] = useState<CustomField[]>([])
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    output_format: 'csv' as 'csv' | 'json' | 'xml',
    platform: '',
    field_selection: [] as string[],
    field_ordering: [] as string[],
    filters: {
      in_stock_only: false,
      min_price: '',
      max_price: '',
      categories: [] as string[]
    },
    file_naming: 'export_{timestamp}',
    delivery_method: 'download' as 'download' | 'feed',
    delivery_config: {},
    is_active: true
  })

  useEffect(() => {
    if (isOpen) {
      fetchFields()
      if (profile) {
        setFormData({
          name: profile.name,
          description: profile.description || '',
          output_format: profile.output_format,
          platform: profile.platform || '',
          field_selection: profile.field_selection || [],
          field_ordering: profile.field_ordering || [],
          filters: profile.filters || {
            in_stock_only: false,
            min_price: '',
            max_price: '',
            categories: []
          },
          file_naming: profile.file_naming || 'export_{timestamp}',
          delivery_method: profile.delivery_method || 'download',
          delivery_config: profile.delivery_config || {},
          is_active: profile.is_active !== undefined ? profile.is_active : true
        })
      } else {
        setFormData({
          name: '',
          description: '',
          output_format: 'csv',
          platform: '',
          field_selection: [],
          field_ordering: [],
          filters: {
            in_stock_only: false,
            min_price: '',
            max_price: '',
            categories: []
          },
          file_naming: 'export_{timestamp}',
          delivery_method: 'download',
          delivery_config: {},
          is_active: true
        })
      }
      setError(null)
    }
  }, [isOpen, profile])

  const fetchFields = async () => {
    if (!activeWorkspaceId) return
    
    try {
      const response = await fetch(`/api/fields/list?workspace_id=${activeWorkspaceId}`)
      const data = await response.json()
      if (response.ok) {
        setFields(data.fields || [])
      }
    } catch (err) {
      console.error('Error fetching fields:', err)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const url = profile 
        ? `/api/exports/${profile.id}`
        : '/api/exports/create'
      
      const method = profile ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          field_selection: formData.field_selection,
          field_ordering: formData.field_ordering,
          filters: {
            ...formData.filters,
            min_price: formData.filters.min_price ? parseFloat(formData.filters.min_price) : undefined,
            max_price: formData.filters.max_price ? parseFloat(formData.filters.max_price) : undefined,
          }
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save export profile')
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to save export profile')
    } finally {
      setLoading(false)
    }
  }

  const toggleFieldSelection = (fieldKey: string) => {
    const isSelected = formData.field_selection.includes(fieldKey)
    if (isSelected) {
      setFormData(prev => ({
        ...prev,
        field_selection: prev.field_selection.filter(k => k !== fieldKey),
        field_ordering: prev.field_ordering.filter(k => k !== fieldKey)
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        field_selection: [...prev.field_selection, fieldKey],
        field_ordering: [...prev.field_ordering, fieldKey]
      }))
    }
  }

  const moveFieldOrder = (fieldKey: string, direction: 'up' | 'down') => {
    const index = formData.field_ordering.indexOf(fieldKey)
    if (index === -1) return

    const newOrder = [...formData.field_ordering]
    if (direction === 'up' && index > 0) {
      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]]
    } else if (direction === 'down' && index < newOrder.length - 1) {
      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]
    }

    setFormData(prev => ({
      ...prev,
      field_ordering: newOrder
    }))
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={profile ? 'Edit Export Profile' : 'Create Export Profile'}
      footer={
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            disabled={loading || !formData.name.trim()}
          >
            {loading ? 'Saving...' : profile ? 'Update' : 'Create'}
          </button>
        </div>
      }
      hideCloseButton
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="My Export Profile"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Optional description"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Output Format *
            </label>
            <select
              value={formData.output_format}
              onChange={(e) => setFormData(prev => ({ ...prev, output_format: e.target.value as 'csv' | 'json' | 'xml' }))}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
              <option value="xml">XML</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Platform
            </label>
            <select
              value={formData.platform}
              onChange={(e) => setFormData(prev => ({ ...prev, platform: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Custom</option>
              <option value="woocommerce">WooCommerce</option>
              <option value="shopify">Shopify</option>
              <option value="magento">Magento</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            File Naming Pattern
          </label>
          <input
            type="text"
            value={formData.file_naming}
            onChange={(e) => setFormData(prev => ({ ...prev, file_naming: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="export_{timestamp}"
          />
          <p className="text-xs text-gray-500 mt-1">
            Use {'{timestamp}'}, {'{format}'}, {'{platform}'} as placeholders
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Delivery Method
          </label>
          <select
            value={formData.delivery_method}
            onChange={(e) => setFormData(prev => ({ ...prev, delivery_method: e.target.value as 'download' | 'feed' }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="download">Download</option>
            <option value="feed">Live Feed</option>
          </select>
          {formData.delivery_method === 'feed' && (
            <p className="text-xs text-gray-500 mt-2">
              A public URL will be generated that serves your export data live. Perfect for Google Merchant, Facebook Catalog, or any feed importer.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Select Fields *
          </label>
          <div className="border border-gray-300 rounded-lg p-4 max-h-60 overflow-y-auto">
            {fields.length === 0 ? (
              <p className="text-sm text-gray-500">No fields available. Create fields first.</p>
            ) : (
              <div className="space-y-2">
                {fields.map((field) => {
                  const isSelected = formData.field_selection.includes(field.key)
                  const orderIndex = formData.field_ordering.indexOf(field.key)
                  return (
                    <div key={field.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleFieldSelection(field.key)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label className="ml-2 text-sm text-gray-700">
                          {field.name} ({field.key})
                        </label>
                      </div>
                      {isSelected && (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => moveFieldOrder(field.key, 'up')}
                            disabled={orderIndex === 0}
                            className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveFieldOrder(field.key, 'down')}
                            disabled={orderIndex === formData.field_ordering.length - 1}
                            className="px-2 py-1 text-xs bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
                          >
                            ↓
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          {formData.field_selection.length > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              Selected: {formData.field_selection.length} field(s). Order: {formData.field_ordering.join(', ')}
            </p>
          )}
        </div>

        <div className="border-t pt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Filters</h3>
          <div className="space-y-3">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={formData.filters.in_stock_only}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  filters: { ...prev.filters, in_stock_only: e.target.checked }
                }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label className="ml-2 text-sm text-gray-700">
                Only include in-stock products
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Min Price</label>
                <input
                  type="number"
                  value={formData.filters.min_price}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    filters: { ...prev.filters, min_price: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Max Price</label>
                <input
                  type="number"
                  value={formData.filters.max_price}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    filters: { ...prev.filters, max_price: e.target.value }
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="9999.99"
                  step="0.01"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            checked={formData.is_active}
            onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label className="ml-2 text-sm text-gray-700">
            Active (profile is enabled)
          </label>
        </div>
      </form>
    </Modal>
  )
}

