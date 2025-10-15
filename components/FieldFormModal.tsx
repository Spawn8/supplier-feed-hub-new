'use client'

import { useState, useEffect } from 'react'
import Modal from './ui/Modal'
import { useWorkspace } from '@/lib/workspaceContext'

interface FieldFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (field: any) => void
  field?: any
}

export default function FieldFormModal({ isOpen, onClose, onSuccess, field }: FieldFormModalProps) {
  const { activeWorkspaceId } = useWorkspace()
  const [formData, setFormData] = useState({
    name: field?.name || '',
    key: field?.key || '',
    datatype: field?.datatype || 'text',
    description: field?.description || '',
    is_required: field?.is_required || false,
    is_unique: field?.is_unique || false
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Update form data when field prop changes
  useEffect(() => {
    if (field) {
      setFormData({
        name: field.name || '',
        key: field.key || '',
        datatype: field.datatype || 'text',
        description: field.description || '',
        is_required: field.is_required || false,
        is_unique: field.is_unique || false
      })
    } else {
      // Reset form for new field
      setFormData({
        name: '',
        key: '',
        datatype: 'text',
        description: '',
        is_required: false,
        is_unique: false
      })
    }
  }, [field])

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
      const url = field ? `/api/fields/${field.id}/update` : '/api/fields/create'
      const method = field ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
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
        throw new Error(data.error || `Failed to ${field ? 'update' : 'create'} field`)
      }

      onSuccess(data.field)
      onClose()
      if (!field) {
        setFormData({
          name: '',
          key: '',
          datatype: 'text',
          description: '',
          is_required: false,
          is_unique: false
        })
      }
    } catch (err) {
      console.error(`Error ${field ? 'updating' : 'creating'} field:`, err)
      setError(err instanceof Error ? err.message : `Failed to ${field ? 'update' : 'create'} field`)
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

  const generateKey = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '_')
      .replace(/^_+|_+$/g, '')
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    setFormData(prev => ({
      ...prev,
      name,
      key: field ? prev.key : generateKey(name)
    }))
  }

  const dataTypes = [
    { value: 'text', label: 'Text', description: 'Plain text string' },
    { value: 'number', label: 'Number', description: 'Numeric value' },
    { value: 'bool', label: 'Boolean', description: 'True/false value' },
    { value: 'date', label: 'Date', description: 'Date and time' },
    { value: 'json', label: 'JSON', description: 'Structured data' }
  ]

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={field ? 'Edit Field' : 'Add New Field'}
      footer={<></>}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            Field Name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleNameChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Product Title"
          />
        </div>

        <div>
          <label htmlFor="key" className="block text-sm font-medium text-gray-700 mb-2">
            Field Key *
          </label>
          <input
            type="text"
            id="key"
            name="key"
            value={formData.key}
            onChange={handleChange}
            required
            pattern="[a-z0-9_]+"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="product_title"
          />
          <p className="text-xs text-gray-500 mt-1">
            Must contain only lowercase letters, numbers, and underscores
          </p>
        </div>

        <div>
          <label htmlFor="datatype" className="block text-sm font-medium text-gray-700 mb-2">
            Data Type *
          </label>
          <select
            id="datatype"
            name="datatype"
            value={formData.datatype}
            onChange={handleChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {dataTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label} - {type.description}
              </option>
            ))}
          </select>
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
            placeholder="Brief description of this field..."
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_required"
              name="is_required"
              checked={formData.is_required}
              onChange={handleChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="is_required" className="ml-2 text-sm text-gray-700">
              Required field
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_unique"
              name="is_unique"
              checked={formData.is_unique}
              onChange={handleChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="is_unique" className="ml-2 text-sm text-gray-700">
              Unique field (no duplicates allowed)
            </label>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !formData.name.trim() || !formData.key.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (field ? 'Updating...' : 'Creating...') : (field ? 'Update Field' : 'Create Field')}
          </button>
        </div>
      </form>
    </Modal>
  )
}