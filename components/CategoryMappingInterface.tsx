'use client'

import { useState, useEffect } from 'react'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import HierarchicalCategorySelect from '@/components/HierarchicalCategorySelect'
import FieldFormModal from '@/components/FieldFormModal'
import { useWorkspace } from '@/lib/workspaceContext'

type SupplierCategory = {
  name: string
  count: number
}

type WorkspaceCategory = {
  id: string
  name: string
  path: string
}

type CategoryMapping = {
  id?: string
  supplier_category: string
  workspace_category_id?: string
  custom_categories?: {
    id: string
    name: string
    path: string
  }
}

interface CategoryMappingInterfaceProps {
  supplierId: string
  supplierName: string
  onClose?: () => void
  onMappingCreated: (mapping: CategoryMapping) => void
  inline?: boolean
  sourceFields?: string[] // Available source fields for category selection
}

export default function CategoryMappingInterface({
  supplierId,
  supplierName,
  onClose,
  onMappingCreated,
  inline = false,
  sourceFields = []
}: CategoryMappingInterfaceProps) {
  const { activeWorkspaceId } = useWorkspace()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [supplierCategories, setSupplierCategories] = useState<SupplierCategory[]>([])
  const [workspaceCategories, setWorkspaceCategories] = useState<WorkspaceCategory[]>([])
  const [existingMappings, setExistingMappings] = useState<CategoryMapping[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedSupplierCategory, setSelectedSupplierCategory] = useState<string>('')
  const [selectedWorkspaceCategory, setSelectedWorkspaceCategory] = useState<string>('')
  
  // Category field selection and enable toggle
  const [categoryFieldEnabled, setCategoryFieldEnabled] = useState(false)
  const [selectedCategoryField, setSelectedCategoryField] = useState<string>('')
  const [categoriesLoaded, setCategoriesLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [showUnlockWarning, setShowUnlockWarning] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  
  // Target fields for category replacement
  const [selectedTargetFields, setSelectedTargetFields] = useState<string[]>([])
  const [allCustomFields, setAllCustomFields] = useState<any[]>([])
  const [showCreateFieldModal, setShowCreateFieldModal] = useState(false)


  // Debug: Log sourceFields when they change
  useEffect(() => {
    console.log('CategoryMappingInterface - sourceFields:', sourceFields)
  }, [sourceFields])

  // Debug: Log selectedCategoryField when it changes
  useEffect(() => {
    console.log('CategoryMappingInterface - selectedCategoryField:', selectedCategoryField)
  }, [selectedCategoryField])

  // Note: Automatic saving removed - settings are only saved when user clicks "Save Settings" button

  // Don't reset anything when toggling - just control visibility
  // The toggle should only show/hide the interface, not reset data

  // Field selection changes are handled by handleFieldChange function
  // No automatic resets on field changes to preserve state

  // Track changes to enable/disable save button
  useEffect(() => {
    // Mark as having changes when any of these change
    setHasUnsavedChanges(true)
  }, [categoryFieldEnabled, selectedCategoryField, categoriesLoaded, existingMappings])

  // Simple state restoration - just load everything when component mounts
  useEffect(() => {
    if (supplierId) {
      loadSettingsAndCategories()
    }
  }, [supplierId])

  const loadSettingsAndCategories = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load workspace categories
      const workspaceRes = await fetch('/api/categories')
      const workspaceData = await workspaceRes.json()
      if (!workspaceRes.ok) throw new Error(workspaceData.error || 'Failed to load workspace categories')
      setWorkspaceCategories(workspaceData.categories || [])

      // Load existing mappings
      const mappingsRes = await fetch(`/api/categories/mappings?supplier_id=${supplierId}`)
      const mappingsData = await mappingsRes.json()
      if (!mappingsRes.ok) throw new Error(mappingsData.error || 'Failed to load mappings')
      setExistingMappings(mappingsData.mappings || [])

      // Load settings from database
      const settingsRes = await fetch(`/api/suppliers/${supplierId}/category-mapping-settings`)
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json()
        if (settingsData.settings) {
          console.log('📋 Loading settings:', settingsData.settings)
          
          // Set all states
          setCategoryFieldEnabled(settingsData.settings.category_mapping_enabled || false)
          setSelectedCategoryField(settingsData.settings.selected_category_field || '')
          setCategoriesLoaded(settingsData.settings.categories_loaded || false)
          setIsLocked(settingsData.settings.categories_loaded || false)
          setSelectedTargetFields(settingsData.settings.target_fields || [])
          
          // If categories were loaded, load them now
          if (settingsData.settings.categories_loaded && settingsData.settings.selected_category_field) {
            console.log('🔄 Loading categories for field:', settingsData.settings.selected_category_field)
            await loadCategoriesData(settingsData.settings.selected_category_field)
          }
        }
      }
      
      // Load all custom fields
      await loadAllCustomFields()

    } catch (e: any) {
      setError(e.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }
  
  const loadAllCustomFields = async () => {
    if (!activeWorkspaceId) return
    
    try {
      const response = await fetch(`/api/fields/list?workspace_id=${activeWorkspaceId}`)
      const data = await response.json()
      if (response.ok) {
        const fields = data.fields || []
        setAllCustomFields(fields)
        
        // Find the field that is currently marked for category mapping
        const activeField = fields.find((f: any) => f.use_for_category_mapping === true)
        
        // If there's an active field and no field is selected yet, preselect it
        if (activeField && selectedTargetFields.length === 0) {
          setSelectedTargetFields([activeField.id])
        }
      }
    } catch (err) {
      console.error('Error fetching custom fields:', err)
    }
  }

  const loadCategoriesData = async (field: string) => {
    try {
      const url = `/api/categories/supplier-categories?supplier_id=${supplierId}&field=${encodeURIComponent(field)}`
      console.log('🌐 Loading categories from:', url)
      
      const res = await fetch(url)
      const data = await res.json()
      console.log('📡 Categories response:', data)
      
      if (!res.ok) throw new Error(data.error || 'Failed to load categories')

      // Process categories
      const categoryCounts = new Map<string, number>()
      data.categories.forEach((cat: string) => {
        categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1)
      })

      const processedCategories = Array.from(categoryCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)

      console.log('✅ Setting categories:', processedCategories)
      setSupplierCategories(processedCategories)
      
    } catch (e: any) {
      console.error('❌ Failed to load categories:', e)
      setError(e.message || 'Failed to load categories')
    }
  }

  const loadCategories = async (forceLoad = false) => {
    console.log('🔄 loadCategories called with:', { forceLoad, categoryFieldEnabled, selectedCategoryField })
    
    if (!forceLoad && !categoryFieldEnabled) {
      setError('Please enable category mapping first')
      return
    }

    if (!selectedCategoryField) {
      setError('Please select a category field first')
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      await loadCategoriesData(selectedCategoryField)
      setCategoriesLoaded(true)
      setIsLocked(true)
      
    } catch (e: any) {
      setError(e.message || 'Failed to load categories')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateMapping = () => {
    if (!selectedSupplierCategory || !selectedWorkspaceCategory) return

    // Create mapping object locally (don't save to database yet)
    const newMapping = {
      id: `temp-${Date.now()}`, // Temporary ID for local storage
      supplier_id: supplierId,
      supplier_category: selectedSupplierCategory,
      workspace_category_id: selectedWorkspaceCategory,
      mapping_type: 'manual',
      rule_config: '{}',
      created_at: new Date().toISOString()
    }

    // Add to local mappings
    setExistingMappings([...existingMappings, newMapping])
    
    // Reset selections
    setSelectedSupplierCategory('')
    setSelectedWorkspaceCategory('')
  }

  const handleSaveSettings = async () => {
    try {
      setSaving(true)
      setError(null)

      // Get all existing mappings from database for this supplier
      const existingRes = await fetch(`/api/categories/mappings?supplier_id=${supplierId}`)
      const existingData = await existingRes.json()
      const dbMappings = existingData.mappings || []

      // Find mappings that were deleted locally (exist in DB but not in local state)
      const localMappingIds = existingMappings.map(m => m.id).filter(id => id && !id.startsWith('temp-'))
      const deletedMappings = dbMappings.filter((dbMapping: any) => 
        !localMappingIds.includes(dbMapping.id)
      )

      // Delete removed mappings from database
      const deletePromises = deletedMappings.map(async (mapping: any) => {
        const res = await fetch(`/api/categories/mappings/${mapping.id}`, {
          method: 'DELETE'
        })
        if (!res.ok) {
          const errorData = await res.json()
          throw new Error(errorData.error || 'Failed to delete mapping')
        }
      })

      await Promise.all(deletePromises)

      // Save new mappings to the database
      const mappingPromises = existingMappings.map(async (mapping) => {
        // Skip if it's already saved (has a real ID, not temp-)
        if (!mapping.id || !mapping.id.startsWith('temp-')) {
          return mapping
        }

        const res = await fetch('/api/categories/mappings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            supplier_id: supplierId,
            supplier_category: mapping.supplier_category,
            workspace_category_id: mapping.workspace_category_id
          })
        })

        if (!res.ok) {
          const errorData = await res.json()
          throw new Error(errorData.error || 'Failed to save mapping')
        }

        const data = await res.json()
        return data.mapping
      })

      // Wait for all mappings to be saved
      const savedMappings = await Promise.all(mappingPromises)

      // Update local state with real IDs
      setExistingMappings(savedMappings)

      // Update custom fields: ensure only ONE field is marked for category mapping
      const selectedFieldId = selectedTargetFields[0] // Only one field allowed
      
      const fieldUpdatePromises = allCustomFields.map(async (field) => {
        const shouldBeMarked = field.id === selectedFieldId
        
        // Only update if the state needs to change
        if (field.use_for_category_mapping !== shouldBeMarked) {
          const res = await fetch(`/api/fields/${field.id}/update`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workspace_id: activeWorkspaceId,
              name: field.name,
              key: field.key,
              datatype: field.datatype,
              description: field.description,
              is_required: field.is_required,
              is_unique: field.is_unique,
              use_for_category_mapping: shouldBeMarked
            })
          })
          
          if (!res.ok) {
            console.error(`Failed to update field ${field.id}`)
          }
        }
      })
      
      await Promise.all(fieldUpdatePromises)
      
      // Reload custom fields to get updated state
      await loadAllCustomFields()

      // Then save the settings
      const settingsRes = await fetch(`/api/suppliers/${supplierId}/category-mapping-settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_mapping_enabled: categoryFieldEnabled,
          selected_category_field: selectedCategoryField,
          target_fields: selectedTargetFields,
          categories_loaded: categoriesLoaded
        })
      })

      if (!settingsRes.ok) {
        const errorData = await settingsRes.json()
        throw new Error(errorData.error || 'Failed to save settings')
      }

      // Show success message
      setError(null)
      // Reset changes flag since we just saved
      setHasUnsavedChanges(false)
      alert('Category mapping settings and mappings saved successfully!')
    } catch (e: any) {
      setError(e.message || 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveMapping = (mappingId: string) => {
    // Remove mapping locally (don't delete from database until save)
    setExistingMappings(existingMappings.filter(m => m.id !== mappingId))
  }

  const handleUnlock = () => {
    setShowUnlockWarning(true)
  }

  const handleConfirmUnlock = () => {
    setShowUnlockWarning(false)
    setIsLocked(false)
    setCategoriesLoaded(false)
    setCategoryFieldEnabled(false) // Also disable the toggle when unlocking
    setExistingMappings([])
    setError(null)
  }

  const handleCancelUnlock = () => {
    setShowUnlockWarning(false)
  }

  const handleFieldChange = (newField: string) => {
    if (isLocked && newField !== selectedCategoryField) {
      const confirmed = confirm(
        `Changing the category field will delete all existing mappings for this supplier. Are you sure you want to continue?\n\nThis action cannot be undone.`
      )
      
      if (!confirmed) {
        return // Don't change the field
      }
      
      // Reset everything when changing field
      setExistingMappings([])
      setCategoriesLoaded(false)
      setIsLocked(false)
    }
    
    setSelectedCategoryField(newField)
  }
  
  const handleFieldCreated = (newField: any) => {
    // Add the new field to the custom fields list
    setAllCustomFields(prev => [...prev, newField])
    setShowCreateFieldModal(false)
  }

  const getMappingForSupplierCategory = (supplierCategory: string) => {
    return existingMappings.find(m => m.supplier_category === supplierCategory)
  }

  const filteredSupplierCategories = supplierCategories.filter(cat =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredWorkspaceCategories = workspaceCategories.filter(cat =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cat.path.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (loading) {
    return inline ? (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    ) : (
      <Modal isOpen={true} onClose={onClose!} title={`Quick Mapping - ${supplierName}`}>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        </div>
      </Modal>
    )
  }

  const handleSetMapping = (supplierCat: string, workspaceCatId: string) => {
    const current = existingMappings.find(m => m.supplier_category === supplierCat)
    
    if (workspaceCatId === '') {
      // Remove mapping locally
      if (current?.id) handleRemoveMapping(current.id)
      return
    }
    
    if (current?.workspace_category_id === workspaceCatId) return
    
    // Remove existing mapping for this supplier category
    if (current?.id) handleRemoveMapping(current.id)
    
    // Create new mapping locally
    const newMapping = {
      id: `temp-${Date.now()}`, // Temporary ID for local storage
      supplier_id: supplierId,
      supplier_category: supplierCat,
      workspace_category_id: workspaceCatId,
      mapping_type: 'manual',
      rule_config: '{}',
      created_at: new Date().toISOString()
    }
    
    // Add to local mappings
    setExistingMappings(prev => {
      const filtered = prev.filter(m => m.supplier_category !== supplierCat)
      return [...filtered, newMapping]
    })
  }

  // Inline (tab) content: table/grid style matching Field Mapping
  const inlineContent = (
    <div className="space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Category Mapping</h3>
          <p className="text-sm text-gray-600 mb-4">Map supplier categories to your workspace categories.</p>
          
          {/* Category Field Selection and Enable Toggle */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Category Field Selection</h4>
                <p className="text-xs text-gray-600">Select which field contains the category information</p>
              </div>
              <div className="flex items-center">
                <label className="flex items-center">
                  <span className="text-sm text-gray-700 mr-3">Enable Category Mapping</span>
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={categoryFieldEnabled}
                      onChange={(e) => setCategoryFieldEnabled(e.target.checked)}
                      disabled={isLocked}
                      className="sr-only"
                    />
                    <div
                      className={`w-11 h-6 rounded-full transition-colors duration-200 ease-in-out ${
                        isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                      } ${
                        categoryFieldEnabled ? 'bg-blue-600' : 'bg-gray-300'
                      }`}
                      onClick={(e) => {
                        e.preventDefault()
                        if (!isLocked) {
                          setCategoryFieldEnabled(!categoryFieldEnabled)
                        }
                      }}
                    >
                      <div
                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out pointer-events-none ${
                          categoryFieldEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </div>
                  </div>
                </label>
              </div>
            </div>
            
            {categoryFieldEnabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Category Field
                </label>
                <div className="flex gap-3">
                  <select
                    value={selectedCategoryField}
                    onChange={(e) => handleFieldChange(e.target.value)}
                    disabled={isLocked}
                    className={`flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isLocked ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                  >
                    <option value="">Select a field...</option>
                    {sourceFields.map(field => (
                      <option key={field} value={field}>{field}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => loadCategories()}
                    disabled={loading || categoriesLoaded || !selectedCategoryField || isLocked}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm whitespace-nowrap"
                  >
                    {loading ? 'Loading...' : categoriesLoaded ? 'Categories Loaded' : 'Load Categories'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {selectedCategoryField 
                    ? `Categories will be extracted from the "${selectedCategoryField}" field`
                    : 'Please select a field to load categories from your supplier data.'
                  }
                </p>
                {isLocked && (
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-green-600">
                      🔒 Interface locked - Categories loaded and ready for mapping
                    </p>
                    <button
                      onClick={handleUnlock}
                      className="px-3 py-1 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
                    >
                      Unlock Interface
                    </button>
                  </div>
                )}
                {categoriesLoaded && (
                  <p className="text-xs text-green-600 mt-1">
                    ✅ Categories loaded successfully! You can now map them below.
                  </p>
                )}
              </div>
            )}
          </div>
          
          {/* Target Field Selection - Show when category field is selected */}
          {categoryFieldEnabled && selectedCategoryField && (
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="mb-3">
                <h4 className="text-sm font-semibold text-gray-900 mb-1">Target Field for Category Replacement</h4>
                <p className="text-xs text-gray-600">Select the custom field that will store the mapped category values</p>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <select
                    value={selectedTargetFields[0] || ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        setSelectedTargetFields([e.target.value])
                      } else {
                        setSelectedTargetFields([])
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                  >
                    <option value="">-- Select a custom field --</option>
                    {allCustomFields.map(field => (
                      <option key={field.id} value={field.id}>
                        {field.name} {field.use_for_category_mapping ? '(Active)' : ''}
                      </option>
                    ))}
                  </select>
                  {selectedTargetFields.length > 0 && (
                    <p className="text-xs text-green-600 mt-1.5">
                      ✓ This field will be marked for category mapping
                    </p>
                  )}
                </div>
                
                <button
                  onClick={() => setShowCreateFieldModal(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium flex items-center gap-2 whitespace-nowrap"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create New Field
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Search - Show when category mapping is enabled and categories are loaded */}
        {categoryFieldEnabled && categoriesLoaded && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Search Categories</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search supplier or workspace categories..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        )}

        {/* Mapping Grid - Show when category mapping is enabled */}
        {categoryFieldEnabled && (
          <>
            {categoriesLoaded ? (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-900">Category Mapping</h4>
              </div>
              <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="col-span-4">Supplier Category</div>
                <div className="col-span-1"></div>
                <div className="col-span-5">Workspace Category</div>
                <div className="col-span-1 text-right">Products</div>
                <div className="col-span-1">Action</div>
              </div>
            </div>
            <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
              {filteredSupplierCategories.map(category => {
                const mapping = getMappingForSupplierCategory(category.name)
                return (
                  <div key={category.name} className="px-4 py-3 hover:bg-gray-50">
                    <div className="grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-4">
                        <div className="font-medium text-sm text-gray-900">{category.name}</div>
                      </div>
                      <div className="col-span-1 text-center">
                        <svg className="w-4 h-4 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </div>
                      <div className="col-span-5">
                        <HierarchicalCategorySelect
                          categories={workspaceCategories}
                          value={mapping?.workspace_category_id || ''}
                          onChange={(categoryId) => handleSetMapping(category.name, categoryId)}
                          placeholder="Select workspace category"
                          className="text-sm"
                        />
                      </div>
                      <div className="col-span-1 text-right">
                        <span className="text-xs text-gray-600">{category.count}</span>
                      </div>
                      <div className="col-span-1 text-center">
                        {mapping ? (
                          <button
                            onClick={() => handleRemoveMapping(mapping.id!)}
                            className="text-red-600 hover:text-red-800"
                            title="Remove mapping"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                <div className="text-yellow-600 mb-2">
                  <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-yellow-900 mb-2">Select Field and Load Categories</h3>
                <p className="text-yellow-700 text-sm">
                  Please select a category field above and click "Load Categories" to start mapping.
                </p>
              </div>
            )}
          </>
        )}

        {/* Summary Cards - Show when category mapping is enabled */}
        {categoryFieldEnabled && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="text-sm font-medium text-blue-900">Supplier Categories</div>
              <div className="text-2xl font-bold text-blue-900">{supplierCategories.length}</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-sm font-medium text-green-900">Mapped Categories</div>
              <div className="text-2xl font-bold text-green-900">{existingMappings.length}</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="text-sm font-medium text-gray-900">Workspace Categories</div>
              <div className="text-2xl font-bold text-gray-900">{workspaceCategories.length}</div>
            </div>
          </div>
        )}
    </div>
  )

  if (inline) {
    return (
      <>
        <div>
          {inlineContent}
        </div>
        
        {/* Unlock Warning Modal */}
        {showUnlockWarning && (
          <Modal 
            isOpen={true} 
            onClose={() => {}} 
            title="Unlock Interface"
            footer={
              <div className="flex justify-end space-x-3">
                <button
                  onClick={handleCancelUnlock}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmUnlock}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Yes, Unlock Interface
                </button>
              </div>
            }
          >
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Warning: This will delete all existing mappings
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>
                        Unlocking the interface will:
                      </p>
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>Delete all current category mappings for this supplier</li>
                        <li>Reset the categories loaded state</li>
                        <li>Allow you to select a different category field</li>
                        <li>Require you to reload categories from the new field</li>
                      </ul>
                      <p className="mt-2 font-medium">
                        This action cannot be undone. Are you sure you want to continue?
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Modal>
        )}
        
        {/* Save Settings Button - Always visible to save toggle state */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSaveSettings}
            disabled={saving || !hasUnsavedChanges}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
        
        {/* Create Field Modal */}
        <FieldFormModal
          isOpen={showCreateFieldModal}
          onClose={() => setShowCreateFieldModal(false)}
          onSuccess={handleFieldCreated}
        />
      </>
    )
  }

  // Modal content: previous "Quick Mapping" builder UI (simple selectors + list + summary)
  const modalContent = (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* Category Field Selection and Enable Toggle for Modal */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-sm font-medium text-gray-900">Category Field Selection</h4>
            <p className="text-xs text-gray-600">Select which field contains the category information</p>
          </div>
          <div className="flex items-center">
            <label className="flex items-center">
              <span className="text-sm text-gray-700 mr-3">Enable Category Mapping</span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={categoryFieldEnabled}
                  onChange={(e) => setCategoryFieldEnabled(e.target.checked)}
                  disabled={isLocked}
                  className="sr-only"
                />
                <div
                  className={`w-11 h-6 rounded-full transition-colors duration-200 ease-in-out ${
                    isLocked ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
                  } ${
                    categoryFieldEnabled ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                  onClick={(e) => {
                    e.preventDefault()
                    if (!isLocked) {
                      setCategoryFieldEnabled(!categoryFieldEnabled)
                    }
                  }}
                >
                  <div
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out pointer-events-none ${
                      categoryFieldEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>
            </label>
          </div>
        </div>
        
        {categoryFieldEnabled && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Category Field
            </label>
            <div className="flex gap-3">
              <select
                value={selectedCategoryField}
                onChange={(e) => handleFieldChange(e.target.value)}
                disabled={isLocked}
                className={`flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isLocked ? 'bg-gray-100 cursor-not-allowed' : ''}`}
              >
                <option value="">Select a field...</option>
                {sourceFields.map(field => (
                  <option key={field} value={field}>{field}</option>
                ))}
              </select>
              <button
                onClick={() => loadCategories()}
                disabled={loading || categoriesLoaded || !selectedCategoryField || isLocked}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm whitespace-nowrap"
              >
                {loading ? 'Loading...' : categoriesLoaded ? 'Categories Loaded' : 'Load Categories'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {selectedCategoryField 
                ? `Categories will be extracted from the "${selectedCategoryField}" field`
                : 'Please select a field to load categories from your supplier data.'
              }
            </p>
            {isLocked && (
              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-green-600">
                  🔒 Interface locked - Categories loaded and ready for mapping
                </p>
                <button
                  onClick={handleUnlock}
                  className="px-3 py-1 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
                >
                  Unlock Interface
                </button>
              </div>
            )}
            {categoriesLoaded && (
              <p className="text-xs text-green-600 mt-1">
                ✅ Categories loaded successfully! You can now map them below.
              </p>
            )}
          </div>
        )}
        
        {/* Target Fields Selection - Show when category field is selected */}
        {categoryFieldEnabled && selectedCategoryField && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Target Fields for Category Replacement</h4>
                <p className="text-xs text-gray-600">Select which fields will be updated with mapped category values</p>
              </div>
            </div>
            
            <div className="flex gap-3 mt-3">
              <select
                multiple
                value={selectedTargetFields}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions, option => option.value)
                  setSelectedTargetFields(values)
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                size={6}
              >
                {allCustomFields.length === 0 ? (
                  <option disabled>No custom fields available</option>
                ) : (
                  allCustomFields.map(field => (
                    <option key={field.id} value={field.id}>
                      {field.name} ({field.key}) {field.use_for_category_mapping ? '✓' : ''}
                    </option>
                  ))
                )}
              </select>
              <button
                onClick={() => setShowCreateFieldModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm whitespace-nowrap"
              >
                Create New Field
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {selectedTargetFields.length > 0 
                ? `✓ ${selectedTargetFields.length} custom field(s) will be marked for category mapping`
                : 'Select custom fields to enable for category mapping (Hold Ctrl/Cmd for multiple)'
              }
            </p>
          </div>
        )}
      </div>

      {categoryFieldEnabled && categoriesLoaded && (
        <>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-900 mb-3">Quick Mapping</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Supplier Category</label>
              <select
                value={selectedSupplierCategory}
                onChange={(e) => setSelectedSupplierCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select supplier category</option>
                {filteredSupplierCategories.map(cat => (
                  <option key={cat.name} value={cat.name}>
                    {cat.name} ({cat.count} products)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Workspace Category</label>
              <HierarchicalCategorySelect
                categories={workspaceCategories}
                value={selectedWorkspaceCategory}
                onChange={setSelectedWorkspaceCategory}
                placeholder="Select workspace category"
                className="text-sm"
              />
            </div>
          </div>
          <div className="mt-3">
            <Button
              onClick={handleCreateMapping}
              disabled={!selectedSupplierCategory || !selectedWorkspaceCategory || loading}
              size="sm"
            >
              {loading ? 'Creating...' : 'Create Mapping'}
            </Button>
          </div>
        </div>

        <div>
            <h3 className="text-sm font-medium text-gray-900 mb-3">
              Supplier Categories ({filteredSupplierCategories.length})
            </h3>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {filteredSupplierCategories.map(category => {
                const mapping = getMappingForSupplierCategory(category.name)
                return (
                  <div
                    key={category.name}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      mapping 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{category.name}</span>
                        <span className="text-xs text-gray-500">({category.count} products)</span>
                      </div>
                      {mapping && (
                        <div className="text-sm text-green-700 mt-1">
                          → {mapping.custom_categories?.path || 'Mapped'}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {mapping ? (
                        <Button
                          onClick={() => handleRemoveMapping(mapping.id!)}
                          variant="danger"
                          size="sm"
                        >
                          Remove
                        </Button>
                      ) : (
                        <Button
                          onClick={() => {
                            setSelectedSupplierCategory(category.name)
                            setSelectedWorkspaceCategory('')
                          }}
                          variant="outline"
                          size="sm"
                        >
                          Map
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {existingMappings.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">
                Current Mappings ({existingMappings.length})
              </h3>
              <div className="space-y-2">
                {existingMappings.map(mapping => (
                  <div key={mapping.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{mapping.supplier_category}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-gray-900">{mapping.custom_categories?.path}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!categoryFieldEnabled ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <div className="text-blue-600 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-blue-900 mb-2">Category Mapping Disabled</h3>
          <p className="text-blue-700 text-sm">
            Enable category mapping above to start mapping supplier categories to your workspace categories.
          </p>
        </div>
      ) : !categoriesLoaded ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <div className="text-yellow-600 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-yellow-900 mb-2">Select Field and Load Categories</h3>
          <p className="text-yellow-700 text-sm">
            Please select a category field above and click "Load Categories" to start mapping.
          </p>
        </div>
      ) : null}
    </div>
  )

  return (
    <>
      <Modal isOpen={true} onClose={onClose!} title={`Quick Mapping - ${supplierName}`}>
        {modalContent}
      </Modal>
      
      {/* Unlock Warning Modal */}
      {showUnlockWarning && (
        <Modal 
          isOpen={true} 
          onClose={() => {}} 
          title="Unlock Interface"
          footer={
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCancelUnlock}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUnlock}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Yes, Unlock Interface
              </button>
            </div>
          }
        >
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Warning: This will delete all existing mappings
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>
                      Unlocking the interface will:
                    </p>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>Delete all current category mappings for this supplier</li>
                      <li>Reset the categories loaded state</li>
                      <li>Allow you to select a different category field</li>
                      <li>Require you to reload categories from the new field</li>
                    </ul>
                    <p className="mt-2 font-medium">
                      This action cannot be undone. Are you sure you want to continue?
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
      
      {/* Create Field Modal */}
      <FieldFormModal
        isOpen={showCreateFieldModal}
        onClose={() => setShowCreateFieldModal(false)}
        onSuccess={handleFieldCreated}
      />
    </>
  )
}
