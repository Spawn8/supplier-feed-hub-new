'use client'

import { useState, useEffect, useCallback } from 'react'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import { useWorkspace } from '@/lib/workspaceContext'
import FieldFormModal from '@/components/FieldFormModal'

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
  workspace_categories?: {
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
}

export default function CategoryMappingInterface({
  supplierId,
  supplierName,
  onClose,
  onMappingCreated,
  inline = false
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

  // Category mapping setup
  const [enableCategoryMapping, setEnableCategoryMapping] = useState<boolean>(false)
  const [categoryFieldName, setCategoryFieldName] = useState<string>('Category')
  const [categorySourceField, setCategorySourceField] = useState<string>('')
  const [supplierKeys, setSupplierKeys] = useState<string[]>([])
  const [savingSetup, setSavingSetup] = useState<boolean>(false)
  const [customFields, setCustomFields] = useState<Array<{ id: string; key: string; name: string }>>([])
  const [setupCompleted, setSetupCompleted] = useState<boolean>(false)
  const [isFieldModalOpen, setIsFieldModalOpen] = useState<boolean>(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [supplierId])

  // Check if setup is already completed by looking for existing field mappings
  useEffect(() => {
    const checkExistingSetup = async () => {
      if (!activeWorkspaceId) return
      try {
        const res = await fetch(`/api/suppliers/${supplierId}/field-mappings?workspace_id=${activeWorkspaceId}`)
        const data = await res.json()
        if (res.ok && data.mappings && data.mappings.length > 0) {
          // Check if there's a category field mapping
          const categoryMapping = data.mappings.find((m: any) => 
            m.source_key && m.source_key.toLowerCase().includes('category')
          )
          if (categoryMapping) {
            setSetupCompleted(true)
            setEnableCategoryMapping(true)
            setCategorySourceField(categoryMapping.source_key)
            // Try to fetch categories with this field
            try {
              const qs = new URLSearchParams({ supplier_id: supplierId, field: categoryMapping.source_key })
              const catRes = await fetch(`/api/categories/supplier-categories?${qs.toString()}`)
              const catData = await catRes.json()
              if (catRes.ok) {
                const cats: string[] = catData.categories || []
                setSupplierCategories(cats.map((name) => ({ name, count: 0 })))
              }
            } catch (err) {
              console.warn('Failed to fetch existing categories:', err)
            }
          }
        }
      } catch (err) {
        console.warn('Failed to check existing setup:', err)
      }
    }
    checkExistingSetup()
  }, [activeWorkspaceId, supplierId])

  useEffect(() => {
    // Load supplier sample keys and existing custom fields for setup controls
    const loadSetupData = async () => {
      try {
        if (!activeWorkspaceId) return
        const [keysRes, fieldsRes] = await Promise.all([
          fetch(`/api/suppliers/${supplierId}/sample-keys?workspace_id=${activeWorkspaceId}`),
          fetch(`/api/fields/list?workspace_id=${activeWorkspaceId}`)
        ])
        if (keysRes.ok) {
          const keysData = await keysRes.json()
          setSupplierKeys(keysData.keys || [])
        }
        if (fieldsRes.ok) {
          const fieldsData = await fieldsRes.json()
          setCustomFields(fieldsData.fields || [])
          // If a category-like field already exists, prefill name and enable toggle hint
          const existingCategory = (fieldsData.fields || []).find((f: any) => f.key?.toLowerCase() === 'category')
          if (existingCategory) {
            setCategoryFieldName(existingCategory.name || 'Category')
          }
        }
      } catch (e) {
        // ignore
      }
    }
    loadSetupData()
  }, [activeWorkspaceId, supplierId])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch supplier categories
      const supplierRes = await fetch(`/api/categories/supplier-categories?supplier_id=${supplierId}`)
      const supplierData = await supplierRes.json()
      if (!supplierRes.ok) throw new Error(supplierData.error || 'Failed to load supplier categories')

      // Fetch custom categories
      const workspaceRes = await fetch('/api/categories')
      const workspaceData = await workspaceRes.json()
      if (!workspaceRes.ok) throw new Error(workspaceData.error || 'Failed to load custom categories')

      // Fetch existing mappings
      const mappingsRes = await fetch(`/api/categories/mappings?supplier_id=${supplierId}`)
      const mappingsData = await mappingsRes.json()
      if (!mappingsRes.ok) throw new Error(mappingsData.error || 'Failed to load mappings')

      // Process supplier categories with counts
      const categoryCounts = new Map<string, number>()
      supplierData.categories.forEach((cat: string) => {
        categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1)
      })

      const processedSupplierCategories = Array.from(categoryCounts.entries())
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count) // Sort by count descending

      setSupplierCategories(processedSupplierCategories)
      setWorkspaceCategories(workspaceData.categories || [])
      setExistingMappings(mappingsData.mappings || [])
    } catch (e: any) {
      setError(e.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateMapping = async () => {
    if (!selectedSupplierCategory || !selectedWorkspaceCategory) return

    try {
      setLoading(true)
      const res = await fetch('/api/categories/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: supplierId,
          supplier_category: selectedSupplierCategory,
          workspace_category_id: selectedWorkspaceCategory
        })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create mapping')

      setExistingMappings([...existingMappings, data.mapping])
      onMappingCreated(data.mapping)
      
      // Reset selections
      setSelectedSupplierCategory('')
      setSelectedWorkspaceCategory('')
    } catch (e: any) {
      setError(e.message || 'Failed to create mapping')
    } finally {
      setLoading(false)
    }
  }

  const toKey = (name: string) =>
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'category'

  const handleSaveCategorySetup = async () => {
    if (!activeWorkspaceId) return
    if (!enableCategoryMapping) return
    if (!categoryFieldName || !categorySourceField) {
      setError('Please provide a field name and select a source field.')
      return
    }
    try {
      setSavingSetup(true)
      setError(null)

      // 1) Ensure custom field exists (text)
      const key = toKey(categoryFieldName)
      let fieldId = customFields.find(f => f.key === key)?.id
      if (!fieldId) {
        const createRes = await fetch('/api/fields/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace_id: activeWorkspaceId,
            name: categoryFieldName,
            key,
            datatype: 'text',
            description: 'Product category',
            is_required: false,
            is_unique: false
          })
        })
        const createData = await createRes.json()
        if (!createRes.ok) throw new Error(createData.error || 'Failed to create category field')
        fieldId = createData.field.id
        setCustomFields(prev => [...prev, { id: fieldId!, key, name: categoryFieldName }])
      }

      // 2) Create field mapping from supplier source to this custom field
      const mapRes = await fetch('/api/suppliers/field-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: supplierId,
          workspace_id: activeWorkspaceId,
          mappings: [
            {
              custom_field_id: fieldId,
              source_field: categorySourceField
            }
          ]
        })
      })
      const mapData = await mapRes.json()
      if (!mapRes.ok) throw new Error(mapData.error || 'Failed to save field mapping')

      // 3) Success
      setError(null)
      setSetupCompleted(true)
      
      // 4) Re-fetch supplier categories now that field mapping is set up
      try {
        const qs = new URLSearchParams({ supplier_id: supplierId })
        if (categorySourceField) qs.set('field', categorySourceField)
        const res = await fetch(`/api/categories/supplier-categories?${qs.toString()}`)
        const data = await res.json()
        if (res.ok) {
          const cats: string[] = data.categories || []
          setSupplierCategories(cats.map((name) => ({ name, count: 0 })))
        }
      } catch (err) {
        console.warn('Failed to re-fetch categories after setup:', err)
      }
      
      // 5) Show success message
      setSuccessMessage('Category mapping setup saved successfully!')
      setTimeout(() => {
        setSuccessMessage(null)
      }, 3000)
    } catch (e: any) {
      setError(e.message || 'Failed to save category mapping setup')
    } finally {
      setSavingSetup(false)
    }
  }

  const handleRemoveMapping = async (mappingId: string) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/categories/mappings/${mappingId}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to remove mapping')
      }

      setExistingMappings(existingMappings.filter(m => m.id !== mappingId))
    } catch (e: any) {
      setError(e.message || 'Failed to remove mapping')
    } finally {
      setLoading(false)
    }
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


  // Inline (tab) content: redesigned with better UX
  const inlineContent = (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-600 text-sm">{successMessage}</p>
        </div>
      )}

      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Category Mapping</h3>
        <p className="text-sm text-gray-500 mt-1">Map supplier product categories to your workspace taxonomy.</p>
      </div>

      {/* Step 1: Setup */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-sm font-medium text-gray-900">Step 1: Configure Category Field</h4>
            <p className="text-xs text-gray-500">Set up which field contains categories in your supplier data.</p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500">Enable</span>
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only"
                checked={enableCategoryMapping}
                onChange={(e) => setEnableCategoryMapping(e.target.checked)}
              />
              <div className={`w-11 h-6 rounded-full relative transition-colors ${
                enableCategoryMapping ? 'bg-blue-600' : 'bg-gray-200'
              }`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  enableCategoryMapping ? 'translate-x-5' : 'translate-x-1'
                }`}></span>
              </div>
            </label>
          </div>
        </div>

        {enableCategoryMapping && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Product Field to Store Categories</label>
                <div className="flex gap-2">
                  <select
                    value={customFields.find(f => f.name === categoryFieldName)?.id || ''}
                    onChange={(e) => {
                      const selected = customFields.find(f => f.id === e.target.value)
                      if (selected) setCategoryFieldName(selected.name)
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select existing field</option>
                    {customFields.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  <Button onClick={() => setIsFieldModalOpen(true)} variant="outline" size="sm">+ New</Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">This field will store the mapped category values.</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Supplier Data Field</label>
                <select
                  value={categorySourceField}
                  onChange={async (e) => {
                    const v = e.target.value
                    setCategorySourceField(v)
                    if (v) {
                      try {
                        const qs = new URLSearchParams({ supplier_id: supplierId, field: v })
                        const res = await fetch(`/api/categories/supplier-categories?${qs.toString()}`)
                        const data = await res.json()
                        if (res.ok) {
                          const cats: string[] = data.categories || []
                          setSupplierCategories(cats.map((name) => ({ name, count: 0 })))
                        }
                      } catch (err) {
                        console.warn('Failed to fetch categories:', err)
                      }
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select field from supplier feed</option>
                  {supplierKeys.map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Which field in your supplier data contains categories?</p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button 
                onClick={handleSaveCategorySetup} 
                disabled={savingSetup || !activeWorkspaceId || !categorySourceField || !categoryFieldName}
              >
                {savingSetup ? 'Saving…' : 'Save Configuration'}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Mapping */}
      {setupCompleted && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="mb-4">
            <h4 className="text-sm font-medium text-gray-900">Step 2: Map Categories</h4>
            <p className="text-xs text-gray-500">Connect supplier categories to your workspace categories.</p>
          </div>

          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search categories..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Categories List */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredSupplierCategories.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 mb-2">
                  <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-500">No categories found</p>
                <p className="text-xs text-gray-400 mt-1">Try selecting a different supplier field or check your data.</p>
              </div>
            ) : (
              filteredSupplierCategories.map(category => {
                const mapping = getMappingForSupplierCategory(category.name)
                return (
                  <div key={category.name} className="flex items-center space-x-4 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <div className="flex-1">
                      <div className="font-medium text-sm text-gray-900">{category.name}</div>
                      <div className="text-xs text-gray-500">{category.count} products</div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </div>
                    
                    <div className="flex-1">
                      <select
                        value={mapping?.workspace_category_id || ''}
                        onChange={(e) => {
                          // Store the selection locally, don't save yet
                          const newMappings = [...existingMappings]
                          const existingIndex = newMappings.findIndex(m => m.supplier_category === category.name)
                          
                          if (e.target.value === '') {
                            // Remove mapping
                            if (existingIndex >= 0) {
                              newMappings.splice(existingIndex, 1)
                            }
                          } else {
                            // Add or update mapping
                            const newMapping = {
                              id: existingMappings.find(m => m.supplier_category === category.name)?.id,
                              supplier_category: category.name,
                              workspace_category_id: e.target.value,
                              workspace_categories: workspaceCategories.find(c => c.id === e.target.value)
                            }
                            
                            if (existingIndex >= 0) {
                              newMappings[existingIndex] = newMapping
                            } else {
                              newMappings.push(newMapping)
                            }
                          }
                          
                          setExistingMappings(newMappings)
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select workspace category</option>
                        {filteredWorkspaceCategories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.path}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {mapping ? (
                        <button 
                          onClick={() => handleRemoveMapping(mapping.id!)} 
                          className="text-red-600 hover:text-red-700 p-1"
                          title="Remove mapping"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button 
              onClick={async () => {
                try {
                  setLoading(true)
                  setError(null)
                  
                  // Save all mappings
                  const savePromises = existingMappings.map(async (mapping) => {
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
                      const data = await res.json()
                      throw new Error(data.error || 'Failed to save mapping')
                    }
                    return res.json()
                  })
                  
                  await Promise.all(savePromises)
                  setError(null)
                  // Refresh the data to show updated mappings
                  await fetchData()
                } catch (e: any) {
                  setError(e.message || 'Failed to save mappings')
                } finally {
                  setLoading(false)
                }
              }}
              disabled={loading}
            >
              {loading ? 'Saving…' : 'Save All Mappings'}
            </Button>
          </div>
        </div>
      )}

      {/* Summary */}
      {setupCompleted && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="text-sm font-medium text-blue-900">Supplier Categories</div>
            <div className="text-2xl font-bold text-blue-900">{supplierCategories.length}</div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="text-sm font-medium text-green-900">Mapped</div>
            <div className="text-2xl font-bold text-green-900">{existingMappings.length}</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="text-sm font-medium text-gray-900">Workspace Categories</div>
            <div className="text-2xl font-bold text-gray-900">{workspaceCategories.length}</div>
          </div>
        </div>
      )}

      {/* Add Field Modal */}
      {isFieldModalOpen && (
        <FieldFormModal
          isOpen={isFieldModalOpen}
          onClose={() => setIsFieldModalOpen(false)}
          onSuccess={(field) => {
            setCustomFields(prev => [...prev, { id: field.id, key: field.key, name: field.name }])
            setCategoryFieldName(field.name)
          }}
        />
      )}
    </div>
  )

  if (inline) {
    return (
      <div>
        {inlineContent}
      </div>
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
            <select
              value={selectedWorkspaceCategory}
              onChange={(e) => setSelectedWorkspaceCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select workspace category</option>
              {filteredWorkspaceCategories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.path}
                </option>
              ))}
            </select>
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
                      → {mapping.workspace_categories?.path || 'Mapped'}
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
                <span className="text-gray-900">{mapping.workspace_categories?.path}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <Modal isOpen={true} onClose={onClose!} title={`Quick Mapping - ${supplierName}`}>
      {modalContent}
    </Modal>
  )
}