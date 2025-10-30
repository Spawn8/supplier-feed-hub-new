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
  DragStartEvent,
  DragOverlay,
  useDroppable,
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

type Category = {
  id: string
  name: string
  path: string
  parent_id?: string
  sort_order: number
  created_at: string
}

type EditableCategory = Category & {
  children: EditableCategory[]
}

interface CategoryTreeEditorProps {
  categories: EditableCategory[]
  onReorder: (categories: EditableCategory[]) => void
  onEdit: (category: Category) => void
  onDelete: (categoryId: string) => void
  onMoveCategory?: (categoryId: string, newParentId: string) => Promise<void>
}

function SortableCategoryItem({ 
  category, 
  index,
  parentPath = '',
  onEdit, 
  onDelete,
  level = 0,
  currentPath,
  renderCategoryTree
}: { 
  category: EditableCategory
  index: number
  parentPath?: string
  onEdit: (category: Category) => void
  onDelete: (categoryId: string) => void
  level?: number
  currentPath?: string
  renderCategoryTree: (categories: EditableCategory[], level?: number, startIndex?: number, parentPath?: string) => React.ReactElement[]
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isItemDragging,
  } = useSortable({ id: category.id })

  const { isOver, setNodeRef: setDroppableRef } = useDroppable({
    id: `droppable-${category.id}`,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isItemDragging ? 'none' : transition,
  }

  const isSubcategory = !!parentPath
  
  return (
    <div 
      className="category-item"
      ref={(node) => {
        setNodeRef(node)
        setDroppableRef(node)
      }}
      style={{
        ...style,
        marginLeft: isSubcategory ? '32px' : '0'
      }}
    >
      <div
        className={`relative bg-white rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 mb-3 ${
          isItemDragging ? 'opacity-50' : ''
        }`}
      >
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-4 flex-1">
            {/* Number Column */}
            <div className="flex items-center space-x-2 w-16">
              <span className="text-sm font-medium text-gray-500 w-6 text-center">
                {parentPath ? `${parentPath}.${index + 1}` : index + 1}
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

            {/* Category Name Column */}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium text-gray-900">{category.name}</div>
                {category.children.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <span className="text-gray-400">({category.children.length})</span>
                  </div>
                )}
              </div>
              <div className="text-sm text-gray-500">{category.path}</div>
            </div>

            {/* Type Column */}
            <div className="w-32">
              <div className="flex items-center">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="ml-2 text-sm text-gray-600">
                  {parentPath ? `Subcategory` : 'Main category'}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-3 ml-4">
            {/* Visibility Column */}
            <div className="w-16 flex justify-center">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
              </label>
            </div>

            {/* Actions Column */}
            <div className="w-20 flex items-center justify-center space-x-2">
              <button 
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(category)
                }} 
                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
                title="Edit category"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(category.id)
                }} 
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                title="Delete category"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Subcategories - Always visible in edit mode */}
      {category.children.length > 0 && (
        <div className="mt-3 relative">
          <div className="space-y-3">
            <SortableContext items={category.children.map(c => c.id)} strategy={verticalListSortingStrategy}>
              {renderCategoryTree(category.children, level + 1, 0, currentPath)}
            </SortableContext>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CategoryTreeEditor({
  categories,
  onReorder,
  onEdit,
  onDelete,
  onMoveCategory
}: CategoryTreeEditorProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [draggedCategory, setDraggedCategory] = useState<EditableCategory | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setIsDragging(true)
    setActiveDragId(event.active.id as string)
    
    // Find the dragged category to show in overlay
    const draggedCat = findCategoryById(categories, event.active.id as string)
    setDraggedCategory(draggedCat)
  }

  // Helper function to find category by ID recursively
  const findCategoryById = (categories: EditableCategory[], id: string): EditableCategory | null => {
    for (const category of categories) {
      if (category.id === id) return category
      const found = findCategoryById(category.children, id)
      if (found) return found
    }
    return null
  }

  // Helper function to find category and its parent in the tree
  const findCategoryAndParent = (categories: EditableCategory[], categoryId: string): { category: EditableCategory | null, parent: EditableCategory | null, index: number } => {
    for (let i = 0; i < categories.length; i++) {
      const category = categories[i]
      if (category.id === categoryId) {
        return { category, parent: null, index: i }
      }
      
      // Recursively check children at any depth
      const result = findCategoryAndParent(category.children, categoryId)
      if (result.category) {
        // If we found it in children, we need to find the direct parent
        if (result.parent === null) {
          // This means the found category is a direct child of the current category
          return { category: result.category, parent: category, index: result.index }
        } else {
          // This means the found category is deeper, return as is
          return result
        }
      }
    }
    return { category: null, parent: null, index: -1 }
  }

  // Helper function to update children order at any depth level
  const updateChildrenOrder = (categories: EditableCategory[], parentId: string, oldIndex: number, newIndex: number): EditableCategory[] => {
    return categories.map(category => {
      if (category.id === parentId) {
        // Found the parent, update its children
        const newChildren = arrayMove(category.children, oldIndex, newIndex)
        const updatedChildren = newChildren.map((child, index) => ({
          ...child,
          sort_order: index
        }))
        return { ...category, children: updatedChildren }
      } else if (category.children.length > 0) {
        // Recursively search in children
        return { ...category, children: updateChildrenOrder(category.children, parentId, oldIndex, newIndex) }
      }
      return category
    })
  }

  // Helper function to move category (with all its subcategories) to new parent
  const moveCategoryToParent = async (categoryId: string, newParentId: string) => {
    if (onMoveCategory) {
      try {
        await onMoveCategory(categoryId, newParentId)
        console.log('Category and all subcategories moved successfully')
      } catch (error) {
        console.error('Error moving category:', error)
        alert('Failed to move category. Please try again.')
      }
    } else {
      // Fallback to direct API call if no callback provided
      try {
        const response = await fetch('/api/categories/move', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            subcategoryId: categoryId,
            newParentId
          })
        })

        if (!response.ok) {
          throw new Error('Failed to move category')
        }

        console.log('Category and all subcategories moved successfully')
        setTimeout(() => {
          window.location.reload()
        }, 300)
      } catch (error) {
        console.error('Error moving category:', error)
        alert('Failed to move category. Please try again.')
      }
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    
    // Reset dragging state
    setIsDragging(false)
    setActiveDragId(null)
    setDraggedCategory(null)

    if (!over) return

    // Check if dropping on a droppable area (cross-container drop)
    if (over.id.toString().startsWith('droppable-')) {
      const targetCategoryId = over.id.toString().replace('droppable-', '')
      const draggedCategoryId = active.id.toString()
      
      // Find the dragged category and target category
      const draggedCategory = findCategoryById(categories, draggedCategoryId)
      const targetCategory = findCategoryById(categories, targetCategoryId)
      
      if (draggedCategory && targetCategory && draggedCategory.id !== targetCategory.id) {
        // Move category (with all its subcategories) to new parent
        moveCategoryToParent(draggedCategoryId, targetCategoryId)
      }
      return
    }

    // Regular reordering within the same container
    if (active.id !== over?.id) {
      const draggedResult = findCategoryAndParent(categories, active.id as string)
      const targetResult = findCategoryAndParent(categories, over.id as string)

      if (draggedResult.category && targetResult.category) {
        // If both categories are at the same level (same parent or both root level)
        if (draggedResult.parent?.id === targetResult.parent?.id) {
          if (draggedResult.parent === null && targetResult.parent === null) {
            // Both are root level categories
            const newCategories = arrayMove(categories, draggedResult.index, targetResult.index)
            
            // Update sort_order for all root categories
            const updatedCategories = newCategories.map((cat, index) => ({
              ...cat,
              sort_order: index
            }))
            
            onReorder(updatedCategories)
          } else if (draggedResult.parent && targetResult.parent && draggedResult.parent.id === targetResult.parent.id) {
            // Both are children of the same parent (at any depth)
            const updatedCategories = updateChildrenOrder(categories, draggedResult.parent.id, draggedResult.index, targetResult.index)
            onReorder(updatedCategories)
          }
        }
      }
    }
  }

  const renderCategoryTree = (categories: EditableCategory[], level = 0, startIndex = 0, parentPath = '') => {
    return categories.map((category, index) => {
      const currentPath = parentPath ? `${parentPath}.${index + 1}` : (index + 1).toString()
      
      return (
        <SortableCategoryItem
          key={category.id}
          category={category}
          index={index}
          parentPath={parentPath}
          onEdit={onEdit}
          onDelete={onDelete}
          level={level}
          currentPath={currentPath}
          renderCategoryTree={renderCategoryTree}
        />
      )
    })
  }

  return (
    <div className="relative">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
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

                {/* Category Name Column */}
                <div className="flex-1">
                  <span className="text-sm font-semibold text-gray-700">Category Name</span>
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
                <div className="w-20">
                  <span className="text-sm font-semibold text-gray-700">Actions</span>
                </div>
              </div>
            </div>
          </div>

          {/* Category Cards */}
          <SortableContext items={categories.map(c => c.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {renderCategoryTree(categories)}
            </div>
          </SortableContext>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {draggedCategory ? (
            <div className="opacity-90">
              <div className="relative bg-white rounded-lg border border-gray-100 shadow-sm mb-3">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center space-x-4 flex-1">
                    <div className="flex items-center space-x-2 w-16">
                      <span className="text-sm font-medium text-gray-500 w-6 text-center">#</span>
                      <div className="cursor-grab p-1 text-gray-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                        </svg>
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{draggedCategory.name}</div>
                      <div className="text-sm text-gray-500">{draggedCategory.path}</div>
                    </div>
                    <div className="w-32">
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="ml-2 text-sm text-gray-600">Category</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
