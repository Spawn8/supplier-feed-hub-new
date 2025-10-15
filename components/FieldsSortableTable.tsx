'use client'

import { useState } from 'react'
import FieldDeleteButton from './FieldDeleteButton'

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

interface FieldsSortableTableProps {
  fields: CustomField[]
  onReorder: (newOrder: Array<{ id: string; sort_order: number }>) => void
  onEdit: (field: CustomField) => void
  onDelete: (fieldId: string) => void
  onSelect?: (field: CustomField) => void
}

export default function FieldsSortableTable({ 
  fields, 
  onReorder, 
  onEdit, 
  onDelete, 
  onSelect 
}: FieldsSortableTableProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null)
      return
    }

    const newFields = [...fields]
    const draggedField = newFields[draggedIndex]
    newFields.splice(draggedIndex, 1)
    newFields.splice(dropIndex, 0, draggedField)

    // Update sort orders
    const newOrder = newFields.map((field, index) => ({
      id: field.id,
      sort_order: index + 1
    }))

    onReorder(newOrder)
    setDraggedIndex(null)
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

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Field
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Properties
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Description
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {fields.map((field, index) => (
            <tr
              key={field.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
              className={`hover:bg-gray-50 cursor-move ${
                draggedIndex === index ? 'opacity-50' : ''
              }`}
            >
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <svg className="w-4 h-4 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                  </svg>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{field.name}</div>
                    <div className="text-sm text-gray-500">{field.key}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDataTypeColor(field.datatype)}`}>
                  {field.datatype}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex space-x-2">
                  {field.is_required && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      Required
                    </span>
                  )}
                  {field.is_unique && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Unique
                    </span>
                  )}
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-gray-900 max-w-xs truncate">
                  {field.description || 'No description'}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <div className="flex items-center justify-end space-x-2">
                  <button
                    onClick={() => onEdit(field)}
                    className="text-blue-600 hover:text-blue-900"
                  >
                    Edit
                  </button>
                  <FieldDeleteButton 
                    fieldId={field.id} 
                    fieldName={field.name}
                    onSuccess={() => onDelete(field.id)}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}