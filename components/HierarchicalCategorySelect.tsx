'use client'

import React, { useState, useRef, useEffect } from 'react'

type Category = {
  id: string
  name: string
  path: string
  parent_id?: string
}

interface HierarchicalCategorySelectProps {
  categories: Category[]
  value: string
  onChange: (categoryId: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export default function HierarchicalCategorySelect({
  categories,
  value,
  onChange,
  placeholder = "Select category",
  className = "",
  disabled = false
}: HierarchicalCategorySelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Get the selected category for display
  const selectedCategory = categories.find(cat => cat.id === value)

  // Build category tree structure
  const buildCategoryTree = (categories: Category[]) => {
    const tree: any[] = []
    const map = new Map<string, any>()
    
    categories.forEach(cat => {
      map.set(cat.id, { ...cat, children: [] })
    })
    
    categories.forEach(cat => {
      if (cat.parent_id && map.has(cat.parent_id)) {
        map.get(cat.parent_id)!.children.push(map.get(cat.id)!)
      } else {
        tree.push(map.get(cat.id)!)
      }
    })
    
    return tree
  }

  // Render hierarchical options
  const renderHierarchicalOptions = (categories: Category[], excludeId?: string) => {
    const renderCategory = (category: Category, depth: number = 0): React.ReactNode => {
      const indent = '— '.repeat(depth)
      
      return (
        <React.Fragment key={category.id}>
          <div
            className={`px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm ${
              value === category.id ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
            }`}
            onClick={() => {
              onChange(category.id)
              setIsOpen(false)
              setSearchTerm('')
            }}
          >
            {indent}{category.name}
          </div>
          {categories
            .filter(cat => cat.parent_id === category.id && cat.id !== excludeId)
            .map(child => renderCategory(child, depth + 1))
          }
        </React.Fragment>
      )
    }
    
    return categories
      .filter(cat => !cat.parent_id && cat.id !== excludeId)
      .map(category => renderCategory(category))
  }

  // Filter categories based on search term
  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cat.path.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearchTerm('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [isOpen])

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Display Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full px-3 py-2 text-left border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
          disabled ? 'bg-gray-100 cursor-not-allowed text-gray-500' : 'bg-white'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className={selectedCategory ? 'text-gray-900' : 'text-gray-500'}>
            {selectedCategory ? selectedCategory.path : placeholder}
          </span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200">
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search categories..."
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          {/* Options */}
          <div className="max-h-48 overflow-y-auto">
            {filteredCategories.length > 0 ? (
              renderHierarchicalOptions(filteredCategories)
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500">
                No categories found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}





