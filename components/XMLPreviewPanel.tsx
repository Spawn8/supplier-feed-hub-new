'use client'

import { useState, useEffect } from 'react'
import Button from './ui/Button'

interface XMLPreviewPanelProps {
  supplierId: string
  workspaceId: string
  sourceFields: string[]
  fieldMappings: Array<{ custom_field_id: string; source_field: string }>
  customFields?: Array<{ id: string; name: string; key: string }>
  onFieldDrop?: (sourceField: string, customFieldId: string) => void
}

interface ProductData {
  id: string
  raw: Record<string, any>
}

export default function XMLPreviewPanel({ 
  supplierId, 
  workspaceId, 
  sourceFields, 
  fieldMappings,
  customFields = [],
  onFieldDrop
}: XMLPreviewPanelProps) {
  const [products, setProducts] = useState<ProductData[]>([])
  const [currentProductIndex, setCurrentProductIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set())
  const [draggedField, setDraggedField] = useState<string | null>(null)
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null)
  const [sortOrder, setSortOrder] = useState<'original' | 'asc' | 'desc'>('original')
  const [localSourceFields, setLocalSourceFields] = useState<string[]>(sourceFields)

  useEffect(() => {
    if (supplierId && workspaceId) {
      fetchSampleProducts()
    }
  }, [supplierId, workspaceId])

  useEffect(() => {
    if (!draggedField) return

    // Clean up when drag ends
    return () => {
      // No additional cleanup needed
    }
  }, [draggedField])

  const fetchSampleProducts = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/suppliers/${supplierId}/raw-data?page=1&limit=5&workspace_id=${workspaceId}`)
      const data = await response.json()
      
      if (response.ok && data.supplier?.products) {
        setProducts(data.supplier.products)
        setCurrentProductIndex(0)
        
        // Extract fields from the first product to get the correct order
        if (data.supplier.products.length > 0) {
          const firstProduct = data.supplier.products[0]
          const rawData = firstProduct.raw || firstProduct
          
          // Use preserved field order if available, otherwise fall back to Object.keys
          let fields: string[]
          if (rawData._fieldOrder) {
            fields = rawData._fieldOrder.filter((key: string) => 
              !['id', 'uid', 'created_at', 'updated_at', '_fieldOrder'].includes(key)
            )
          } else {
            fields = Object.keys(rawData).filter(key => 
              !['id', 'uid', 'created_at', 'updated_at'].includes(key)
            )
          }
          
          // Update local source fields with the correct order
          if (fields.length > 0) {
            setLocalSourceFields(fields)
          }
        }
      } else {
        setError(data.error || 'Failed to load sample data')
      }
    } catch (err) {
      setError('Failed to load sample data')
    } finally {
      setLoading(false)
    }
  }

  const currentProduct = products[currentProductIndex]
  const hasNext = currentProductIndex < products.length - 1
  const hasPrev = currentProductIndex > 0

  const toggleFieldExpansion = (fieldName: string) => {
    setExpandedFields(prev => {
      const newSet = new Set(prev)
      if (newSet.has(fieldName)) {
        newSet.delete(fieldName)
      } else {
        newSet.add(fieldName)
      }
      return newSet
    })
  }

  const getFieldValue = (fieldName: string) => {
    if (!currentProduct?.raw) return null
    return currentProduct.raw[fieldName]
  }

  const isFieldMapped = (fieldName: string) => {
    return fieldMappings.some(mapping => mapping.source_field === fieldName)
  }

  const getMappedFieldName = (fieldName: string) => {
    const mappings = fieldMappings.filter(m => m.source_field === fieldName)
    if (mappings.length === 0) return null
    
    // Get all custom field names that are mapped to this source field
    const mappedFieldNames = mappings.map(mapping => {
      const customField = customFields.find(f => f.id === mapping.custom_field_id)
      return customField ? customField.name : mapping.custom_field_id
    })
    
    if (mappedFieldNames.length === 1) {
      return `→ ${mappedFieldNames[0]}`
    } else {
      return `→ ${mappedFieldNames.length} fields (${mappedFieldNames.join(', ')})`
    }
  }

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'null'
    if (typeof value === 'object') return JSON.stringify(value, null, 2)
    return String(value)
  }

  const getSortedFields = () => {
    const fieldsToUse = localSourceFields.length > 0 ? localSourceFields : sourceFields
    
    if (sortOrder === 'original') {
      return fieldsToUse
    }
    
    const sorted = [...fieldsToUse].sort((a, b) => {
      if (sortOrder === 'asc') {
        return a.localeCompare(b)
      } else {
        return b.localeCompare(a)
      }
    })
    
    return sorted
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="text-center">
          <div className="text-red-600 text-sm mb-2">Failed to load preview</div>
          <div className="text-gray-500 text-xs">{error}</div>
          <Button 
            onClick={fetchSampleProducts}
            size="sm"
            className="mt-3"
          >
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (!currentProduct) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="text-center text-gray-500 text-sm">
          No sample data available
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Global Drag Overlay */}
      {draggedField && (
            <div
              className="fixed top-0 left-0 pointer-events-none z-50"
              style={{
                transform: `translate(${dragPosition?.x || 0}px, ${dragPosition?.y || 0}px)`,
              }}
            >
              <div className="bg-blue-600 text-white px-2 py-1 rounded-full shadow-lg border border-blue-500 flex items-center space-x-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                </svg>
                <span className="font-medium text-sm">{draggedField}</span>
              </div>
            </div>
      )}
      
      <div className="bg-white border border-gray-200 rounded-lg">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-900">XML Preview</h3>
            <p className="text-xs text-gray-500">
              Product {currentProductIndex + 1} of {products.length}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500">Sort:</span>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as 'original' | 'asc' | 'desc')}
              className="text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="original">Original</option>
              <option value="asc">A-Z</option>
              <option value="desc">Z-A</option>
            </select>
          </div>
          <div className="flex items-center space-x-3">
            <Button
              onClick={() => setCurrentProductIndex(Math.max(0, currentProductIndex - 1))}
              disabled={!hasPrev}
              size="sm"
              variant="outline"
            >
              ← Previous
            </Button>
            
            {/* Page Selector */}
            <div className="flex items-center bg-white border border-gray-300 rounded-lg px-3 py-2 h-8">
              <input
                type="number"
                min="1"
                max={products.length}
                value={currentProductIndex + 1}
                onChange={(e) => {
                  const page = parseInt(e.target.value)
                  if (page >= 1 && page <= products.length) {
                    setCurrentProductIndex(page - 1)
                  }
                }}
                className="w-12 text-center text-sm font-medium border-none outline-none bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                title={`Go to page 1-${products.length}`}
              />
            </div>
            
            <Button
              onClick={() => setCurrentProductIndex(Math.min(products.length - 1, currentProductIndex + 1))}
              disabled={!hasNext}
              size="sm"
              variant="outline"
            >
              Next →
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {getSortedFields().map((fieldName) => {
            const value = getFieldValue(fieldName)
            const isMapped = isFieldMapped(fieldName)
            const mappedFieldName = getMappedFieldName(fieldName)
            const isExpanded = expandedFields.has(fieldName)
            
            return (
              <div 
                key={fieldName} 
                className="border border-gray-200 rounded-lg transition-all hover:shadow-md"
              >
                <div 
                  className="px-3 py-2 cursor-pointer hover:bg-gray-50"
                  onClick={() => toggleFieldExpansion(fieldName)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div
                        className="cursor-grab hover:cursor-grabbing p-1 hover:bg-gray-100 rounded transition-all"
                        draggable
                        onDragStart={(e) => {
                          setDraggedField(fieldName)
                          setDragPosition({ x: e.clientX - 15, y: e.clientY - 15 })
                          e.dataTransfer.setData('text/plain', fieldName)
                          e.dataTransfer.effectAllowed = 'copy'
                          
                          // Hide the default drag ghost image
                          const dragImage = new Image()
                          dragImage.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs='
                          e.dataTransfer.setDragImage(dragImage, 0, 0)
                        }}
                        onDrag={(e) => {
                          if (e.clientX !== 0 && e.clientY !== 0) {
                            setDragPosition({ x: e.clientX - 15, y: e.clientY - 15 })
                          }
                        }}
                        onDragEnd={() => {
                          setDraggedField(null)
                          setDragPosition(null)
                        }}
                        title="Drag to map this field"
                      >
                        <svg className={`w-4 h-4 text-gray-400 transition-all ${
                          draggedField === fieldName ? 'opacity-0' : ''
                        }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                        </svg>
                      </div>
                      <span className="font-medium text-sm text-gray-900">{fieldName}</span>
                      {isMapped && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Mapped
                        </span>
                      )}
                      {mappedFieldName && (
                        <span className="text-xs text-blue-600">{mappedFieldName}</span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <svg 
                        className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-gray-100">
                    <div className="mt-2">
                      <div className="text-xs text-gray-500 mb-1">Value:</div>
                      <pre className="text-xs text-gray-700 bg-gray-50 p-2 rounded border overflow-x-auto">
                        {formatValue(value)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Summary */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-gray-500">Total Fields:</span>
              <span className="ml-1 font-medium">{sourceFields.length}</span>
            </div>
            <div>
              <span className="text-gray-500">Mapped:</span>
              <span className="ml-1 font-medium text-green-600">
                {fieldMappings.length}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
