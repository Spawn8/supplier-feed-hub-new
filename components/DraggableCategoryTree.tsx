'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
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
import LoadingOverlay from './ui/LoadingOverlay'


// Function to get category level name based on parentPath
function getCategoryLevelName(parentPath: string): string {
  if (!parentPath) {
    return 'Main category'
  }
  
  const level = parentPath.split('.').length + 1
  
  switch (level) {
    case 2:
      return 'Subcategory'
    case 3:
      return '3rd level category'
    case 4:
      return '4th level category'
    case 5:
      return '5th level category'
    case 6:
      return '6th level category'
    case 7:
      return '7th level category'
    case 8:
      return '8th level category'
    case 9:
      return '9th level category'
    default:
      return `${level}th level category`
  }
}

type Category = {
  id: string
  name: string
  path: string
  parent_id?: string
  sort_order: number
  created_at: string
}

type DraggableCategory = Category & {
  children: DraggableCategory[]
}

interface DraggableCategoryTreeProps {
  categories: DraggableCategory[]
  onReorder: (categories: DraggableCategory[]) => void
  onRefresh: () => void
  onEdit: (category: Category) => void
  onDelete: (categoryId: string) => void
}

function SortableCategoryItem({ 
  category, 
  index,
  parentPath = '',
  onEdit, 
  onDelete,
  expandedCategories,
  onToggleExpanded,
  isDragging,
  activeDragId,
  allCategories,
  level = 0,
  currentPath,
  renderCategoryTree
}: { 
  category: DraggableCategory
  index: number
  parentPath?: string
  onEdit: (category: Category) => void
  onDelete: (categoryId: string) => void
  expandedCategories: Set<string>
  onToggleExpanded: (categoryId: string) => void
  isDragging: boolean
  activeDragId: string | null
  allCategories: DraggableCategory[]
  level?: number
  currentPath?: string
  renderCategoryTree: (categories: DraggableCategory[], level?: number, startIndex?: number, parentPath?: string) => React.ReactElement[]
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

  // Check if this category has open subcategories that should be grouped
  const hasOpenSubcategories = category.children.length > 0 && expandedCategories.has(category.id)

  // Check if this is a subcategory of a category that's being dragged
  const isChildOfDraggedParent = isDragging && parentPath && activeDragId &&
    allCategories.some(cat => 
      cat.id === activeDragId && 
      expandedCategories.has(cat.id) &&
      parentPath.startsWith(cat.id)
    )

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : transition,
  }

  // If this is a child of a dragged parent, apply the same transform
  const childStyle = isChildOfDraggedParent ? {
    transform: CSS.Transform.toString(transform),
    transition: 'none',
  } : {}

  // Determine if this is a subcategory based on parentPath
  const isSubcategory = !!parentPath
  const subcategoryLevel = parentPath ? parentPath.split('.').length : 0
  const isExpanded = expandedCategories.has(category.id)
  
  // Check if this category is being dragged (to hide it from original position)
  const isBeingDragged = isDragging && activeDragId === category.id
  
  // Calculate total tree height recursively based on current expanded state
  const calculateTreeHeight = (categories: DraggableCategory[]): number => {
    let totalHeight = 0
    categories.forEach(cat => {
      totalHeight += 80 // Base height for each category
      // Only add children height if they are currently expanded
      if (cat.children.length > 0 && expandedCategories.has(cat.id)) {
        totalHeight += calculateTreeHeight(cat.children)
      }
    })
    return totalHeight
  }
  
  return (
    <div 
      className="category-item"
      ref={(node) => {
        setNodeRef(node)
        setDroppableRef(node)
      }}
        style={{
          ...style,
          ...childStyle,
          marginLeft: isSubcategory ? '32px' : '0'
        }}
    >
      <div
        className={`relative bg-white rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 mb-3 ${
          isItemDragging ? 'opacity-50' : ''
        }`}
        style={{
          ...(isItemDragging && {
            border: '2px dashed #d1d5db',
            backgroundColor: '#f9fafb',
            minHeight: category.children.length > 0 && expandedCategories.has(category.id) 
              ? `${80 + calculateTreeHeight(category.children)}px` 
              : '80px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          })
        }}
      >
        {isItemDragging ? (
          <div className="flex items-center justify-center w-full h-full text-gray-400">
            <div className="text-center">
              <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
              <p className="text-sm">Dragging...</p>
            </div>
          </div>
        ) : (
          <div 
            className={`flex items-center justify-between p-4 ${
              category.children.length > 0 ? 'cursor-pointer' : ''
            }`}
            onClick={category.children.length > 0 ? () => onToggleExpanded(category.id) : undefined}
          >
            <div className="flex items-center space-x-4 flex-1">
              {/* Number Column - matches header width */}
              <div className="flex items-center space-x-2 w-16">
                <span className="text-sm font-medium text-gray-500 w-6 text-center">
                  {parentPath ? `${parentPath}.${index + 1}` : index + 1}
                </span>
                <div
                  {...attributes}
                  {...listeners}
                  className="cursor-grab hover:cursor-grabbing p-1 text-gray-400 hover:text-gray-600"
                  onClick={(e) => e.stopPropagation()}
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
                      <svg 
                        className={`w-4 h-4 transition-transform duration-300 ease-out ${
                          isExpanded ? 'rotate-90' : ''
                        }`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="text-sm text-gray-500">{category.path}</div>
              </div>

              {/* Type Column - matches header width */}
              <div className="w-32">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="ml-2 text-sm text-gray-600">{getCategoryLevelName(parentPath)}</span>
                </div>
              </div>
            </div>

            {/* Actions - matches header layout */}
            <div className="flex items-center space-x-3 ml-4">
              {/* Visibility Column - matches header width */}
              <div className="w-16 flex justify-center">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                </label>
              </div>

              {/* Actions Column - matches header width */}
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
        )}
      </div>
      
      {/* Subcategories inside the draggable category-item */}
      {category.children.length > 0 && !isBeingDragged && (
        <div className="mt-3 relative">
          <div className={`overflow-hidden transition-all duration-300 ease-out ${
            expandedCategories.has(category.id) 
              ? 'max-h-screen opacity-100 transform translate-y-0' 
              : 'max-h-0 opacity-0 transform -translate-y-2'
          }`}>
            <div className="space-y-3">
              <SortableContext items={category.children.map(c => c.id)} strategy={verticalListSortingStrategy}>
                {renderCategoryTree(category.children, level + 1, 0, currentPath)}
              </SortableContext>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DraggableCategoryTree({
  categories,
  onReorder,
  onRefresh,
  onEdit,
  onDelete
}: DraggableCategoryTreeProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [isReordering, setIsReordering] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [draggedCategory, setDraggedCategory] = useState<DraggableCategory | null>(null)

  // Build a flat list of all category ids for defaults
  const allCategoryIds = useMemo<string[]>(() => {
    const ids: string[] = []
    const walk = (nodes: DraggableCategory[]) => {
      nodes.forEach(n => {
        ids.push(n.id)
        if (n.children?.length) walk(n.children)
      })
    }
    walk(categories)
    return ids
  }, [categories])

  // Initialize expanded state from sessionStorage, default: expand all
  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? sessionStorage.getItem('categories_expanded_state') : null
      if (saved) {
        const parsed: string[] = JSON.parse(saved)
        setExpandedCategories(new Set(parsed))
      } else {
        // default expand all
        setExpandedCategories(new Set(allCategoryIds))
      }
    } catch {
      setExpandedCategories(new Set(allCategoryIds))
    }
  }, [allCategoryIds])

  // Persist expanded state for the session
  useEffect(() => {
    if (expandedCategories.size > 0) {
      try {
        const arr = Array.from(expandedCategories)
        sessionStorage.setItem('categories_expanded_state', JSON.stringify(arr))
      } catch {}
    }
  }, [expandedCategories])

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

  const handleDragOver = (event: DragOverEvent) => {
    // Optional: Add any drag over logic here
  }

  // Helper function to find category by ID recursively
  const findCategoryById = (categories: DraggableCategory[], id: string): DraggableCategory | null => {
    for (const category of categories) {
      if (category.id === id) return category
      const found = findCategoryById(category.children, id)
      if (found) return found
    }
    return null
  }

  // Helper function to move category (with all its subcategories) to new parent
  const moveCategoryToParent = async (categoryId: string, newParentId: string) => {
    setIsReordering(true)
    try {
      const response = await fetch('/api/categories/move', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subcategoryId: categoryId, // API still uses subcategoryId parameter name
          newParentId
        })
      })

      if (!response.ok) {
        throw new Error('Failed to move category')
      }

      // Show success feedback
      console.log('Category and all subcategories moved successfully')
      
      // Refresh the categories list after successful move
      setTimeout(() => {
        window.location.reload()
      }, 300)
    } catch (error) {
      console.error('Error moving category:', error)
      alert('Failed to move category. Please try again.')
    } finally {
      setIsReordering(false)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
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
        await moveCategoryToParent(draggedCategoryId, targetCategoryId)
      }
      return
    }

    // Regular reordering within the same container
    if (active.id !== over?.id) {
      const oldIndex = categories.findIndex(cat => cat.id === active.id)
      const newIndex = categories.findIndex(cat => cat.id === over?.id)

      if (oldIndex !== -1 && newIndex !== -1) {
        const newCategories = arrayMove(categories, oldIndex, newIndex)
        
        // Update sort_order for all affected categories
        const updatedCategories = newCategories.map((cat, index) => ({
          ...cat,
          sort_order: index
        }))

        // Show loading overlay during API call
        setIsReordering(true)
        try {
          await onReorder(updatedCategories)
        } catch (error) {
          console.error('Error reordering categories:', error)
        } finally {
          setIsReordering(false)
        }
      }
    }
  }

  const toggleExpanded = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId)
    } else {
      newExpanded.add(categoryId)
    }
    setExpandedCategories(newExpanded)
  }

  // Function to calculate the total height of the tree structure
  const calculateTreeHeight = (categories: DraggableCategory[]): number => {
    let totalHeight = 0
    
    categories.forEach(category => {
      // Add height for this category (80px for each category)
      totalHeight += 80
      
      // Recursively add height for children if they exist
      if (category.children.length > 0) {
        totalHeight += calculateTreeHeight(category.children)
      }
    })
    
    return totalHeight
  }

  const renderCategoryTree = (categories: DraggableCategory[], level = 0, startIndex = 0, parentPath = '') => {
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
          expandedCategories={expandedCategories}
          onToggleExpanded={toggleExpanded}
          isDragging={isDragging}
          activeDragId={activeDragId}
          allCategories={categories}
          level={level}
          currentPath={currentPath}
          renderCategoryTree={renderCategoryTree}
        />
      )
    })
  }

  // Helper to compute ordinal path like "1.2.3" for a given id based on current visible ordering
  const getOrdinalPath = (nodes: DraggableCategory[], targetId: string, parentOrdinal = ''): string => {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      const currentOrdinal = parentOrdinal ? `${parentOrdinal}.${i + 1}` : `${i + 1}`
      if (node.id === targetId) return currentOrdinal
      const childResult = getOrdinalPath(node.children, targetId, currentOrdinal)
      if (childResult) return childResult
    }
    return ''
  }

  // Function to render complete tree structure in drag overlay with exact same components and stable ordinals
  const renderCategoryTreeInOverlay = (nodes: DraggableCategory[]) => {
    return nodes.map((category) => {
      const ordinalPath = getOrdinalPath(categories, category.id)
      const parentOrdinalPath = ordinalPath.includes('.') ? ordinalPath.substring(0, ordinalPath.lastIndexOf('.')) : ''
      const subcategoryLevel = parentOrdinalPath ? parentOrdinalPath.split('.').length : 0
      const isExpanded = expandedCategories.has(category.id)

       return (
         <div key={category.id}>
           <div 
             className="category-item"
             style={{
               marginLeft: subcategoryLevel && category.id !== draggedCategory?.id ? '32px' : '0'
             }}
           >
            <div className="relative bg-white rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 mb-3">
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center space-x-4 flex-1">
                  {/* Number Column - matches header width */}
                  <div className="flex items-center space-x-2 w-16">
                    <span className="text-sm font-medium text-gray-500 w-6 text-center">
                      {ordinalPath}
                    </span>
                    <div className="cursor-grab hover:cursor-grabbing p-1 text-gray-400 hover:text-gray-600">
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
                          <svg 
                            className={`w-4 h-4 transition-transform duration-300 ease-out ${
                              isExpanded ? 'rotate-90' : ''
                            }`}
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">{category.path}</div>
                  </div>

                  {/* Type Column - matches header width */}
                  <div className="w-32">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="ml-2 text-sm text-gray-600">{getCategoryLevelName(parentOrdinalPath)}</span>
                    </div>
                  </div>
                </div>

                {/* Actions - matches header layout */}
                <div className="flex items-center space-x-3 ml-4">
                  {/* Visibility Column - matches header width */}
                  <div className="w-16 flex justify-center">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </label>
                  </div>

                  {/* Actions Column - matches header width */}
                  <div className="w-20 flex items-center justify-center space-x-2">
                    <button 
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" 
                      title="Edit category"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button 
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

             {/* Subcategories inside the draggable category-item */}
             {category.children.length > 0 && (
               <div className="mt-3 relative">
                <div className={`overflow-hidden transition-all duration-300 ease-out ${
                  expandedCategories.has(category.id) 
                    ? 'max-h-screen opacity-100 transform translate-y-0' 
                    : 'max-h-0 opacity-0 transform -translate-y-2'
                }`}>
                  <div className="space-y-3">
                    {renderCategoryTreeInOverlay(category.children)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )
    })
  }

  return (
    <div className="relative">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
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

        {/* Drag Overlay - shows the exact same category components */}
        <DragOverlay>
          {draggedCategory ? (
            <div className="opacity-90">
              {renderCategoryTreeInOverlay([draggedCategory])}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Global Loading Overlay */}
      <LoadingOverlay 
        isVisible={isReordering} 
        message="Reordering categories… Please wait" 
      />
    </div>
  )
}