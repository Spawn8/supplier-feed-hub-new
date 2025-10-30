'use client'

import { useState, useEffect } from 'react'
import XMLPreviewPanel from './XMLPreviewPanel'
import FieldFormModal from './FieldFormModal'

interface FieldMapping {
  custom_field_id: string
  source_field: string
}

interface CustomField {
  id: string
  name: string
  key: string
  datatype: string
  description?: string
  is_required?: boolean
  is_unique?: boolean
}

interface UniversalFieldMappingProps {
  // Data
  customFields: CustomField[]
  sourceFields: string[]
  fieldMappings: FieldMapping[]
  
  // Required props
  supplierId: string
  workspaceId: string
  
  // Callbacks - now optional since we can handle internally
  onFieldMapping?: (fieldId: string, sourceField: string) => void
  onFieldDrop?: (sourceField: string, customFieldId: string) => void
  onFieldCreated?: (field: CustomField) => void
  onFieldUpdated?: (field: CustomField) => void
  
  // New callback for when mappings change
  onMappingsChange?: (mappings: FieldMapping[]) => void
  
  // Optional features
  showAddNewField?: boolean
  showEditFields?: boolean
  showActionButtons?: boolean
  
  // Styling
  className?: string
}

export default function UniversalFieldMapping({
  customFields,
  sourceFields,
  fieldMappings,
  supplierId,
  workspaceId,
  onFieldMapping,
  onFieldDrop,
  onFieldCreated,
  onFieldUpdated,
  onMappingsChange,
  showAddNewField = true,
  showEditFields = true,
  showActionButtons = true,
  className = ''
}: UniversalFieldMappingProps) {
  
  // Internal state for field mappings
  const [internalFieldMappings, setInternalFieldMappings] = useState<FieldMapping[]>(fieldMappings)
  
  // Update internal state when prop changes
  useEffect(() => {
    setInternalFieldMappings(fieldMappings)
  }, [fieldMappings])
  
  // Modal states
  const [showCreateFieldModal, setShowCreateFieldModal] = useState(false)
  const [editingField, setEditingField] = useState<CustomField | null>(null)
  const [dragOverFieldId, setDragOverFieldId] = useState<string | null>(null)

  // Internal field mapping logic
  const handleInternalFieldMapping = (customFieldId: string, sourceField: string) => {
    setInternalFieldMappings(prev => {
      const existing = prev.find(m => m.custom_field_id === customFieldId)
      
      if (existing) {
        if (sourceField === '') {
          // Remove the mapping if sourceField is empty
          return prev.filter(m => m.custom_field_id !== customFieldId)
        } else {
          // Update the existing mapping
          return prev.map(m => 
            m.custom_field_id === customFieldId 
              ? { ...m, source_field: sourceField }
              : m
          )
        }
      } else if (sourceField !== '') {
        // Add new mapping - allow multiple custom fields to map to the same source field
        return [...prev, { custom_field_id: customFieldId, source_field: sourceField }]
      }
      
      return prev
    })
  }

  const handleInternalFieldDrop = (sourceField: string, customFieldId: string) => {
    handleInternalFieldMapping(customFieldId, sourceField)
  }

  // Notify parent when mappings change
  useEffect(() => {
    if (onMappingsChange && !onFieldMapping) {
      onMappingsChange(internalFieldMappings)
    }
  }, [internalFieldMappings, onMappingsChange, onFieldMapping])

  // When onMappingsChange is provided, use external fieldMappings for display
  // When onFieldMapping is provided, use external fieldMappings and external callback
  // Otherwise, use internal state
  const currentMappings = (onMappingsChange || onFieldMapping) ? fieldMappings : internalFieldMappings
  const handleMapping = onFieldMapping || handleInternalFieldMapping
  const handleDrop = onFieldDrop || handleInternalFieldDrop
  
  
  // Helper function to get mapping info for a source field
  const getSourceFieldMappingInfo = (sourceField: string) => {
    const mappings = currentMappings.filter(m => m.source_field === sourceField)
    if (mappings.length === 0) return null
    
    const customFieldNames = mappings.map(mapping => {
      const customField = customFields.find(f => f.id === mapping.custom_field_id)
      return customField ? customField.name : mapping.custom_field_id
    })
    
    return {
      count: mappings.length,
      fields: customFieldNames
    }
  }


  // Handlers
  const handleFieldCreated = (newField: CustomField) => {
    onFieldCreated?.(newField)
    setShowCreateFieldModal(false)
  }

  const handleFieldUpdated = (updatedField: CustomField) => {
    onFieldUpdated?.(updatedField)
    setEditingField(null)
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Main Content Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Field Mapping Interface */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Field Mapping</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Map your custom fields to the source fields from your supplier data.
                </p>
              </div>
              
              {/* Field Mapping Table */}
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <div className="grid grid-cols-12 gap-4 items-center">
                    <div className="col-span-5 text-sm font-medium text-gray-700">Custom Field</div>
                    <div className="col-span-1 text-center text-sm font-medium text-gray-700">→</div>
                    <div className="col-span-4 text-sm font-medium text-gray-700">Source Field</div>
                    <div className="col-span-2 text-center text-sm font-medium text-gray-700">Action</div>
                  </div>
                </div>
                
                <div className="divide-y divide-gray-200">
                  {customFields.map((field, index) => (
                    <div 
                      key={field.id} 
                      className={`px-4 py-3 ${
                        dragOverFieldId === field.id 
                          ? 'bg-blue-50' 
                          : 'hover:bg-gray-50'
                      }`}
                      style={dragOverFieldId === field.id ? {
                        outline: '2px dashed #93c5fd',
                        outlineOffset: '-2px'
                      } : {}}
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'copy'
                        setDragOverFieldId(field.id)
                      }}
                      onDragLeave={() => {
                        setDragOverFieldId(null)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        setDragOverFieldId(null)
                        const sourceField = e.dataTransfer.getData('text/plain')
                        if (sourceField) {
                          handleDrop(sourceField, field.id)
                        }
                      }}
                    >
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-5">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="flex items-center space-x-1">
                                <div className="font-medium text-sm text-gray-900">{field.name}</div>
                                {field.description && (
                                  <div className="group relative">
                                    <svg className="w-3 h-3 text-gray-400 hover:text-gray-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                                      {field.description}
                                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 font-mono mt-1">{field.key}</div>
                            </div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-normal ${
                              field.datatype === 'text' 
                                ? 'bg-blue-50 text-blue-600' 
                                : field.datatype === 'number' 
                                ? 'bg-green-50 text-green-600'
                                : field.datatype === 'date'
                                ? 'bg-purple-50 text-purple-600'
                                : field.datatype === 'boolean'
                                ? 'bg-orange-50 text-orange-600'
                                : 'bg-gray-50 text-gray-500'
                            }`}>
                              {field.datatype}
                            </span>
                          </div>
                        </div>
                        
                        <div className="col-span-1 text-center">
                          <svg className={`w-4 h-4 mx-auto ${currentMappings.find(m => m.custom_field_id === field.id) ? 'text-green-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </div>
                        
                        <div className="col-span-4">
                          <select
                            value={(() => {
                              const mapping = currentMappings.find(m => m.custom_field_id === field.id)
                              return mapping?.source_field || ''
                            })()}
                            onChange={(e) => handleMapping(field.id, e.target.value)}
                            className="w-full text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">Select source field</option>
                            {sourceFields.map((sourceField) => {
                              const mappingInfo = getSourceFieldMappingInfo(sourceField)
                              const isCurrentlyMapped = currentMappings.find(m => m.custom_field_id === field.id)?.source_field === sourceField
                              
                              return (
                                <option key={sourceField} value={sourceField}>
                                  {sourceField}
                                  {mappingInfo && !isCurrentlyMapped && ` (mapped to ${mappingInfo.count} other field${mappingInfo.count > 1 ? 's' : ''})`}
                                </option>
                              )
                            })}
                          </select>
                        </div>
                        
                        <div className="col-span-2 flex justify-center space-x-1">
                          {showEditFields && (
                            <button
                              onClick={() => setEditingField(field)}
                              className="w-8 h-8 bg-blue-100 hover:bg-blue-200 rounded-lg flex items-center justify-center text-blue-600 hover:text-blue-700 transition-colors"
                              title="Edit field"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          )}
                          
                          {currentMappings.find(m => m.custom_field_id === field.id) ? (
                            <button
                              onClick={() => handleMapping(field.id, '')}
                              className="w-8 h-8 bg-red-100 hover:bg-red-200 rounded-lg flex items-center justify-center text-red-600 hover:text-red-700 transition-colors"
                              title="Remove mapping"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          ) : (
                            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                              <span className="text-gray-400 text-xs">-</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add New Field Button - Always Visible */}
              {showAddNewField && (
                <div className="mt-6 flex justify-between items-center">
                  <button
                    onClick={() => setShowCreateFieldModal(true)}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-200 shadow-sm"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add New Field
                  </button>
                  
                  <div className="flex items-center space-x-4">
                    {currentMappings.length === 0 && (
                      <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        ⚠️ No fields mapped yet.
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>


        {/* XML Preview Panel */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">XML Preview</h3>
                <p className="text-sm text-gray-600 mb-2">
                  Preview actual XML data to understand field contents and structure.
                </p>
                <p className="text-xs text-blue-600 bg-blue-50 p-2 rounded border mb-4">
                  💡 <strong>Tip:</strong> Drag any field from here to the mapping table on the left to automatically select it!
                </p>
              </div>
              
              <XMLPreviewPanel
                supplierId={supplierId}
                workspaceId={workspaceId}
                sourceFields={sourceFields}
                fieldMappings={currentMappings}
                customFields={customFields}
                onFieldDrop={handleDrop}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Create Field Modal */}
      {showAddNewField && (
        <FieldFormModal
          isOpen={showCreateFieldModal}
          onClose={() => setShowCreateFieldModal(false)}
          onSuccess={handleFieldCreated}
        />
      )}

      {/* Edit Field Modal */}
      {showEditFields && (
        <FieldFormModal
          isOpen={!!editingField}
          onClose={() => setEditingField(null)}
          onSuccess={handleFieldUpdated}
          field={editingField}
        />
      )}
    </div>
  )
}
