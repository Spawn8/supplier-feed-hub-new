'use client'

import { useState } from 'react'
import DraggableFieldsTable from './DraggableFieldsTable'
import FieldFormModal from './FieldFormModal'

interface CustomField {
  id: string
  name: string
  key: string
  datatype: string
  description?: string
  is_required: boolean
  is_unique: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

interface FieldsListProps {
  fields: CustomField[]
  onFieldSelect?: (field: CustomField) => void
  onFieldUpdated?: () => void
  onCreateField?: () => void
}

export default function FieldsList({ fields, onFieldSelect, onFieldUpdated, onCreateField }: FieldsListProps) {
  const [error, setError] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<CustomField | null>(null)

  const fetchFields = async () => {
    if (onFieldUpdated) {
      onFieldUpdated()
    }
  }

  const handleDeleteSuccess = (fieldId: string) => {
    if (onFieldUpdated) {
      onFieldUpdated()
    }
  }

  const handleReorder = async (newOrder: Array<{ id: string; sort_order: number }>) => {
    try {
      const response = await fetch('/api/fields/reorder', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fieldOrders: newOrder }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to reorder fields')
      }

      // Refresh fields from parent
      if (onFieldUpdated) {
        onFieldUpdated()
      }
    } catch (err) {
      console.error('Error reordering fields:', err)
      setError('Failed to reorder fields')
      throw err // Re-throw to let the component handle the loading state
    }
  }

  const getDataTypeColor = (datatype: string) => {
    switch (datatype) {
      case 'text':
        return 'bg-blue-100 text-blue-800'
      case 'number':
        return 'bg-green-100 text-green-800'
      case 'bool':
        return 'bg-purple-100 text-purple-800'
      case 'date':
        return 'bg-orange-100 text-orange-800'
      case 'json':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }


  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchFields}
            className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {fields.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No custom fields yet</h3>
          <p className="text-gray-500 mb-4">Create your first field to start mapping supplier data</p>
          <button
            onClick={() => onCreateField?.()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Your First Field
          </button>
        </div>
      ) : (
        <DraggableFieldsTable
          fields={fields}
          onReorder={handleReorder}
          onEdit={(field) => setEditingField(field)}
          onDelete={(fieldId) => handleDeleteSuccess(fieldId)}
          onSelect={onFieldSelect}
        />
      )}

      <FieldFormModal
        isOpen={!!editingField}
        onClose={() => setEditingField(null)}
        onSuccess={(field) => {
          setEditingField(null)
          if (onFieldUpdated) {
            onFieldUpdated()
          }
        }}
        field={editingField}
      />
    </div>
  )
}








