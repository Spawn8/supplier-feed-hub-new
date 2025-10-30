'use client'

import React, { useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import FieldDeleteButton from './FieldDeleteButton'
import LoadingOverlay from './ui/LoadingOverlay'
import Modal from './ui/Modal'
import Button from './ui/Button'

interface CustomField {
  id: string
  name: string
  key: string
  datatype: string
  description?: string
  is_required: boolean
  is_unique: boolean
  is_visible: boolean
  use_for_category_mapping?: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

interface DraggableFieldsTableProps {
  fields: CustomField[]
  onReorder: (newOrder: Array<{ id: string; sort_order: number }>) => void
  onEdit: (field: CustomField) => void
  onDelete: (fieldId: string) => void
  onSelect?: (field: CustomField) => void
  onFieldUpdated?: () => void
}

function SortableFieldItem({ 
  field, 
  index,
  onEdit, 
  onDelete, 
  onSelect,
  onVisibilityChange,
  onCategoryMappingToggle
}: { 
  field: CustomField
  index: number
  onEdit: (field: CustomField) => void
  onDelete: (fieldId: string) => void
  onSelect?: (field: CustomField) => void
  onVisibilityChange?: (fieldId: string, isVisible: boolean) => void
  onCategoryMappingToggle?: (fieldId: string, currentValue: boolean) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
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
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow mb-3 ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center space-x-4 flex-1">
          {/* Number Column - matches header width */}
          <div className="flex items-center space-x-2 w-16">
            <span className="text-sm font-medium text-gray-500 w-6 text-center">
              {index + 1}
            </span>
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab hover:cursor-grabbing p-1 text-gray-400 hover:text-gray-600"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
            </div>
          </div>

          {/* Field Name Column */}
          <div className="flex-1">
            <div className="text-sm font-medium text-gray-900">{field.name}</div>
            <div className="text-sm text-gray-500">{field.key}</div>
            {field.description && (
              <div className="text-xs text-gray-400 mt-1">{field.description}</div>
            )}
          </div>

          {/* Type Column - matches header width */}
          <div className="w-32">
            <div className="flex flex-col space-y-1">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getDataTypeColor(field.datatype)}`}>
                {field.datatype}
              </span>
              <div className="flex space-x-1">
                {field.is_required && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    Required
                  </span>
                )}
                {field.is_unique && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                    Unique
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Actions - matches header layout */}
        <div className="flex items-center space-x-3 ml-4">
          {/* Visibility Column - matches header width */}
          <div className="w-16 flex justify-center">
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={field.is_visible}
                onChange={(e) => onVisibilityChange?.(field.id, e.target.checked)}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
            </label>
          </div>

          {/* Category Mapping Column - matches header width */}
          <div className="w-16 flex justify-center">
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={field.use_for_category_mapping || false}
                onChange={() => onCategoryMappingToggle?.(field.id, field.use_for_category_mapping || false)}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
            </label>
          </div>

          {/* Actions Column - matches header width */}
          <div className="w-20 flex items-center justify-center space-x-2">
            <button
              onClick={() => onEdit(field)}
              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Edit field"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <FieldDeleteButton
              fieldId={field.id}
              fieldName={field.name}
              onSuccess={() => onDelete(field.id)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DraggableFieldsTable({ 
  fields, 
  onReorder, 
  onEdit, 
  onDelete, 
  onSelect,
  onFieldUpdated
}: DraggableFieldsTableProps) {
  const [isReordering, setIsReordering] = useState(false)
  const [updatingVisibility, setUpdatingVisibility] = useState<string | null>(null)
  const [localFields, setLocalFields] = useState(fields)
  const [showCategoryMappingModal, setShowCategoryMappingModal] = useState(false)
  const [pendingCategoryMappingChange, setPendingCategoryMappingChange] = useState<{
    fieldId: string
    fieldName: string
    currentValue: boolean
  } | null>(null)

  // Update local fields when props change
  React.useEffect(() => {
    setLocalFields(fields)
  }, [fields])

  const handleVisibilityChange = async (fieldId: string, isVisible: boolean) => {
    // Update the local state immediately (optimistic update)
    setLocalFields(prevFields => 
      prevFields.map(field => 
        field.id === fieldId ? { ...field, is_visible: isVisible } : field
      )
    )
    
    // Show loading overlay while saving to server
    setUpdatingVisibility(fieldId)
    try {
      const response = await fetch(`/api/fields/${fieldId}/visibility`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_visible: isVisible }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update field visibility')
      }

      // Call onFieldUpdated to refresh the parent component and products page
      if (onFieldUpdated) {
        onFieldUpdated()
      }
    } catch (error) {
      console.error('Error updating field visibility:', error)
      // Revert the optimistic update on error
      setLocalFields(prevFields => 
        prevFields.map(field => 
          field.id === fieldId ? { ...field, is_visible: !isVisible } : field
        )
      )
      // You might want to show a toast notification here
    } finally {
      setUpdatingVisibility(null)
    }
  }

  const handleCategoryMappingToggle = (fieldId: string, currentValue: boolean) => {
    const field = localFields.find(f => f.id === fieldId)
    if (!field) return

    // If trying to enable and another field is already enabled, show warning
    if (!currentValue) {
      const currentlyEnabledField = localFields.find(f => f.use_for_category_mapping && f.id !== fieldId)
      if (currentlyEnabledField) {
        setPendingCategoryMappingChange({
          fieldId,
          fieldName: field.name,
          currentValue
        })
        setShowCategoryMappingModal(true)
        return
      }
    }

    // If disabling or no conflict, apply directly
    applyCategoryMappingChange(fieldId, !currentValue)
  }

  const applyCategoryMappingChange = async (fieldId: string, newValue: boolean) => {
    const field = localFields.find(f => f.id === fieldId)
    if (!field) return

    setUpdatingVisibility(fieldId)
    try {
      // First, unmark all other fields
      const updatePromises = localFields.map(async (f) => {
        if (f.id === fieldId) {
          // Update the target field
          const response = await fetch(`/api/fields/${f.id}/update`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workspace_id: f.workspace_id,
              name: f.name,
              key: f.key,
              datatype: f.datatype,
              description: f.description,
              is_required: f.is_required,
              is_unique: f.is_unique,
              use_for_category_mapping: newValue
            })
          })
          if (!response.ok) throw new Error('Failed to update field')
        } else if (f.use_for_category_mapping) {
          // Unmark other fields
          const response = await fetch(`/api/fields/${f.id}/update`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workspace_id: f.workspace_id,
              name: f.name,
              key: f.key,
              datatype: f.datatype,
              description: f.description,
              is_required: f.is_required,
              is_unique: f.is_unique,
              use_for_category_mapping: false
            })
          })
          if (!response.ok) throw new Error('Failed to update field')
        }
      })

      await Promise.all(updatePromises)

      // Refresh fields
      if (onFieldUpdated) {
        onFieldUpdated()
      }
    } catch (error) {
      console.error('Error updating category mapping:', error)
    } finally {
      setUpdatingVisibility(null)
    }
  }

  const handleConfirmCategoryMappingChange = async () => {
    if (!pendingCategoryMappingChange) return

    await applyCategoryMappingChange(pendingCategoryMappingChange.fieldId, !pendingCategoryMappingChange.currentValue)
    
    setShowCategoryMappingModal(false)
    setPendingCategoryMappingChange(null)
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      const oldIndex = localFields.findIndex(field => field.id === active.id)
      const newIndex = localFields.findIndex(field => field.id === over?.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        const newFields = arrayMove(localFields, oldIndex, newIndex)
        
        // Update sort orders
        const newOrder = newFields.map((field, index) => ({
          id: field.id,
          sort_order: index + 1
        }))

        // Show loading overlay during API call
        setIsReordering(true)
        try {
          await onReorder(newOrder)
        } catch (error) {
          console.error('Error reordering fields:', error)
        } finally {
          setIsReordering(false)
        }
      }
    }
  }

  return (
    <div className="relative">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div>
          {/* Header Row */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 flex-1">
                {/* Number Column */}
                <div className="flex items-center space-x-2 w-16">
                  <span className="text-sm font-semibold text-gray-700">#</span>
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </div>

                {/* Field Name Column */}
                <div className="flex-1">
                  <span className="text-sm font-semibold text-gray-700">Field Name</span>
                </div>

                {/* Type Column */}
                <div className="w-32">
                  <span className="text-sm font-semibold text-gray-700">Type</span>
                </div>
              </div>

              {/* Actions Header */}
              <div className="flex items-center space-x-3 ml-4">
                <div className="w-16">
                  <span className="text-sm font-semibold text-gray-700">Visibility</span>
                </div>
                <div className="w-16">
                  <span className="text-sm font-semibold text-gray-700">Category</span>
                </div>
                <div className="w-20">
                  <span className="text-sm font-semibold text-gray-700">Actions</span>
                </div>
              </div>
            </div>
          </div>

          {/* Field Cards */}
          <div className="space-y-3">
            <SortableContext items={localFields.map(f => f.id)} strategy={verticalListSortingStrategy}>
              {localFields.map((field, index) => (
                <SortableFieldItem
                  key={field.id}
                  field={field}
                  index={index}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onSelect={onSelect}
                  onVisibilityChange={handleVisibilityChange}
                  onCategoryMappingToggle={handleCategoryMappingToggle}
                />
              ))}
            </SortableContext>
          </div>
        </div>
      </DndContext>

      {/* Global Loading Overlay */}
      <LoadingOverlay 
        isVisible={isReordering || updatingVisibility !== null} 
        message={isReordering ? "Reordering fields… Please wait" : "Updating visibility… Please wait"} 
      />

      {/* Category Mapping Confirmation Modal */}
      <Modal
        isOpen={showCategoryMappingModal}
        onClose={() => {
          setShowCategoryMappingModal(false)
          setPendingCategoryMappingChange(null)
        }}
        title="Change Category Mapping Field"
        hideCloseButton={true}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowCategoryMappingModal(false)
                setPendingCategoryMappingChange(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmCategoryMappingChange}
            >
              Yes, Change Field
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-yellow-900">
                  Only one field can be used for category mapping at a time.
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  Changing to "{pendingCategoryMappingChange?.fieldName}" will disable category mapping for the currently active field.
                </p>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-600">
            Are you sure you want to change the category mapping field?
          </p>
        </div>
      </Modal>
    </div>
  )
}
