'use client'

import React from 'react'

type Category = {
  id: string
  name: string
  path: string
  parent_id?: string
  sort_order: number
  created_at: string
}

type ViewableCategory = Category & {
  children: ViewableCategory[]
}

interface CategoryTreeViewProps {
  categories: ViewableCategory[]
  expandedCategories: Set<string>
  onToggleExpanded: (categoryId: string) => void
  onEdit: (category: Category) => void
  onDelete: (categoryId: string) => void
}

function CategoryItem({ 
  category, 
  index,
  parentPath = '',
  onEdit, 
  onDelete,
  expandedCategories,
  onToggleExpanded,
  level = 0,
  currentPath,
  renderCategoryTree
}: { 
  category: ViewableCategory
  index: number
  parentPath?: string
  onEdit: (category: Category) => void
  onDelete: (categoryId: string) => void
  expandedCategories: Set<string>
  onToggleExpanded: (categoryId: string) => void
  level?: number
  currentPath?: string
  renderCategoryTree: (categories: ViewableCategory[], level?: number, startIndex?: number, parentPath?: string) => React.ReactElement[]
}) {
  const isExpanded = expandedCategories.has(category.id)
  const isSubcategory = !!parentPath
  
  return (
    <div className="category-item" style={{ marginLeft: isSubcategory ? '32px' : '0' }}>
      <div className="relative bg-white rounded-lg border border-gray-100 shadow-sm hover:shadow-md transition-all duration-200 mb-3">
        <div 
          className={`flex items-center justify-between p-4 ${
            category.children.length > 0 ? 'cursor-pointer' : ''
          }`}
          onClick={category.children.length > 0 ? () => onToggleExpanded(category.id) : undefined}
        >
          <div className="flex items-center space-x-4 flex-1">
            {/* Number Column */}
            <div className="flex items-center space-x-2 w-16">
              <span className="text-sm font-medium text-gray-500 w-6 text-center">
                {parentPath ? `${parentPath}.${index + 1}` : index + 1}
              </span>
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
      
      {/* Subcategories */}
      {category.children.length > 0 && (
        <div className="mt-3 relative">
          <div className={`overflow-hidden transition-all duration-300 ease-out ${
            expandedCategories.has(category.id) 
              ? 'max-h-screen opacity-100 transform translate-y-0' 
              : 'max-h-0 opacity-0 transform -translate-y-2'
          }`}>
            <div className="space-y-3">
              {renderCategoryTree(category.children, level + 1, 0, currentPath)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CategoryTreeView({
  categories,
  expandedCategories,
  onToggleExpanded,
  onEdit,
  onDelete
}: CategoryTreeViewProps) {
  const renderCategoryTree = (categories: ViewableCategory[], level = 0, startIndex = 0, parentPath = '') => {
    return categories.map((category, index) => {
      const currentPath = parentPath ? `${parentPath}.${index + 1}` : (index + 1).toString()
      
      return (
        <CategoryItem
          key={category.id}
          category={category}
          index={index}
          parentPath={parentPath}
          onEdit={onEdit}
          onDelete={onDelete}
          expandedCategories={expandedCategories}
          onToggleExpanded={onToggleExpanded}
          level={level}
          currentPath={currentPath}
          renderCategoryTree={renderCategoryTree}
        />
      )
    })
  }

  return (
    <div>
      {/* Header Row */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1">
            {/* Number Column */}
            <div className="flex items-center space-x-2 w-16">
              <span className="text-sm font-semibold text-gray-700">#</span>
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
      <div className="space-y-3">
        {renderCategoryTree(categories)}
      </div>
    </div>
  )
}
