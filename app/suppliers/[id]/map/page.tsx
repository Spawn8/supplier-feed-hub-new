'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabaseClient'
import { useWorkspace } from '@/lib/workspaceContext'

interface FieldMapping {
  custom_field_id: string
  source_field: string
}

export default function SupplierMapPage() {
  const { activeWorkspaceId } = useWorkspace()
  const [user, setUser] = useState<any>(null)
  const [supplier, setSupplier] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  
  // Field mapping state (same as wizard)
  const [customFields, setCustomFields] = useState<any[]>([])
  const [sourceFields, setSourceFields] = useState<string[]>([])
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([])
  const [originalMappings, setOriginalMappings] = useState<FieldMapping[]>([])
  
  const router = useRouter()
  const params = useParams()
  const supplierId = params.id as string

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (user && supplierId && activeWorkspaceId) {
      fetchData()
    }
  }, [user, supplierId, activeWorkspaceId])

  const fetchData = async () => {
    try {
      // Fetch all data in sequence to ensure proper loading
      console.log('🔄 Starting data fetch sequence...')
      
      // 1. First fetch custom fields (needed for mapping transformation)
      await fetchCustomFields()
      
      // 2. Then fetch supplier and source fields
      await fetchSupplier()
      
      // 3. Finally fetch existing mappings (requires custom fields to be loaded)
      await fetchExistingMappings()
      
      console.log('✅ Data fetch sequence completed')
    } catch (err) {
      console.error('❌ Error in data fetch sequence:', err)
    }
  }

  const checkUser = async () => {
    try {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      setUser(user)
    } catch (error) {
      console.error('Error checking user:', error)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  const fetchSupplier = async () => {
    if (!activeWorkspaceId) return
    
    try {
      const response = await fetch(`/api/suppliers/${supplierId}/details?workspace_id=${activeWorkspaceId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load supplier')
      }

      setSupplier(data.supplier)
      
      // Fetch source fields from supplier
      await fetchSourceFields(data.supplier)
    } catch (err) {
      console.error('Error fetching supplier:', err)
      setError(err instanceof Error ? err.message : 'Failed to load supplier')
    }
  }

  const fetchCustomFields = async () => {
    if (!activeWorkspaceId) return
    
    try {
      const response = await fetch(`/api/fields/list?workspace_id=${activeWorkspaceId}`)
      const data = await response.json()
      
      if (response.ok) {
        setCustomFields(data.fields || [])
      }
    } catch (err) {
      console.error('Error fetching custom fields:', err)
    }
  }

  const fetchSourceFields = async (supplierData: any) => {
    if (!activeWorkspaceId) return
    
    try {
      console.log('🔍 Fetching source fields for supplier:', supplierId)
      
      const response = await fetch(`/api/suppliers/${supplierId}/sample-keys?workspace_id=${activeWorkspaceId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()
      console.log('📋 Sample keys response:', data)
      
      if (response.ok) {
        // The API returns { keys: [...], total_records: N, sample_size: N }
        if (data.keys && Array.isArray(data.keys)) {
          setSourceFields(data.keys)
          console.log('✅ Set source fields:', data.keys)
        } else {
          console.log('⚠️ No keys found in response')
          setSourceFields([])
        }
      } else {
        console.error('❌ Sample keys API error:', data)
        // Try fallback: get fields from raw data if available
        await fetchSourceFieldsFromRawData()
      }
    } catch (err) {
      console.error('❌ Error fetching source fields:', err)
      // Try fallback: get fields from raw data if available
      await fetchSourceFieldsFromRawData()
    }
  }

  const fetchSourceFieldsFromRawData = async () => {
    try {
      console.log('🔄 Trying fallback: fetching source fields from raw data')
      
      const response = await fetch(`/api/suppliers/${supplierId}/raw-data?page=1&limit=1`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()
      
      if (response.ok && data.supplier?.products?.length > 0) {
        const firstProduct = data.supplier.products[0]
        const rawData = firstProduct.raw || firstProduct
        
        // Extract all keys from the raw data
        const fields = Object.keys(rawData).filter(key => 
          !['id', 'uid', 'created_at', 'updated_at'].includes(key)
        ).sort()
        
        if (fields.length > 0) {
          setSourceFields(fields)
          console.log('✅ Set source fields from raw data:', fields)
          return
        }
      }
      
      console.log('⚠️ No source fields available from any source')
      setSourceFields([])
    } catch (err) {
      console.error('❌ Error fetching source fields from raw data:', err)
      setSourceFields([])
    }
  }

  const fetchExistingMappings = async () => {
    if (!activeWorkspaceId) return
    
    try {
      console.log('🔍 Fetching existing field mappings for supplier:', supplierId)
      
      // Fetch field mappings from dedicated endpoint
      const response = await fetch(`/api/suppliers/${supplierId}/field-mappings?workspace_id=${activeWorkspaceId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()
      console.log('📋 Existing mappings response:', data)
      console.log('📋 Full response data structure:', {
        mappings: data.mappings,
        hasFieldMappings: !!data.mappings,
        fieldMappingsLength: data.mappings?.length || 0
      })
      
      if (response.ok && data.mappings) {
        // The database structure stores field_key which might be either the field ID or the field key
        // We need to match it with our custom fields to get the correct ID
        console.log('📋 Custom fields for reference:', customFields)
        
        const transformedMappings = data.mappings.map((mapping: any) => {
          // Check if field_key is a UUID (field ID) or a string key
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mapping.field_key)
          
          let custom_field_id = mapping.field_key
          
          if (!isUUID) {
            // field_key is actually a field key, find the corresponding field ID
            const matchingField = customFields.find(f => f.key === mapping.field_key)
            custom_field_id = matchingField ? matchingField.id : mapping.field_key
          }
          
          return {
            custom_field_id: custom_field_id,
            source_field: mapping.source_key || mapping.source_field // Handle both possible field names
          }
        })
        
        console.log('✅ Transformed mappings:', transformedMappings)
        console.log('🔍 Custom fields for comparison:', customFields.map(f => ({ id: f.id, name: f.name, key: f.key })))
        setFieldMappings(transformedMappings)
        setOriginalMappings([...transformedMappings]) // Store original state
      } else {
        console.log('⚠️ No existing mappings found')
        setFieldMappings([])
      }
    } catch (err) {
      console.error('❌ Error fetching existing mappings:', err)
      setFieldMappings([])
    }
  }

  const updateSupplierSyncStatus = async (supplierId: string, status: string) => {
    try {
      const response = await fetch(`/api/suppliers/${supplierId}/update-sync-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sync_status: status,
          workspace_id: activeWorkspaceId
        }),
      })

      if (!response.ok) {
        console.error('Failed to update supplier sync status')
      }
    } catch (err) {
      console.error('Error updating supplier sync status:', err)
    }
  }

  const handleFieldMapping = (customFieldId: string, sourceField: string) => {
    setFieldMappings(prev => {
      const existing = prev.find(m => m.custom_field_id === customFieldId)
      if (existing) {
        if (sourceField === '') {
          // Remove mapping
          return prev.filter(m => m.custom_field_id !== customFieldId)
        } else {
          // Update mapping
          return prev.map(m => 
            m.custom_field_id === customFieldId 
              ? { ...m, source_field: sourceField }
              : m
          )
        }
      } else if (sourceField !== '') {
        // Add new mapping
        return [...prev, { custom_field_id: customFieldId, source_field: sourceField }]
      }
      return prev
    })
  }

  const handleSaveMappings = async () => {
    if (!activeWorkspaceId) return
    
    try {
      setSaving(true)
      setError(null)
      
      const response = await fetch('/api/suppliers/field-mappings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          supplier_id: supplierId,
          workspace_id: activeWorkspaceId,
          mappings: fieldMappings
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save mappings')
      }

      // Check if mappings have changed from original
      const mappingsChanged = JSON.stringify(fieldMappings) !== JSON.stringify(originalMappings)
      
      if (mappingsChanged) {
        // Update supplier status to indicate sync is needed
        await updateSupplierSyncStatus(supplierId, 'sync_needed')
      }
      
      // Redirect to suppliers page with success message
      const supplierName = encodeURIComponent(supplier?.name || 'Supplier')
      router.push(`/suppliers?mapping_saved=true&supplier_name=${supplierName}&sync_needed=${mappingsChanged}`)
    } catch (err) {
      console.error('Error saving mappings:', err)
      setError(err instanceof Error ? err.message : 'Failed to save mappings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-lg font-medium mb-4">{error}</div>
          <button
            onClick={() => router.push('/suppliers')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Suppliers
          </button>
        </div>
      </div>
    )
  }

  if (!supplier) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-600 text-lg font-medium mb-4">Supplier not found</div>
          <button
            onClick={() => router.push('/suppliers')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Suppliers
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Edit Field Mapping</h1>
              <p className="mt-2 text-lg text-gray-600">
                Edit field mappings for {supplier.name}
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => router.push('/suppliers')}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Back to Suppliers
              </button>
            </div>
          </div>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-green-700">{successMessage}</p>
              </div>
            </div>
          </div>
        )}

        {/* Field Mapping Interface - Exact copy from wizard */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Field Mapping</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Map your custom fields to the source fields from your supplier data.
                </p>
                
                {/* Mapping Table */}
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-700 uppercase tracking-wider">
                      <div className="col-span-4">Custom Field</div>
                      <div className="col-span-1 text-center">→</div>
                      <div className="col-span-4">Source Field</div>
                      <div className="col-span-2">Data Type</div>
                      <div className="col-span-1">Action</div>
                    </div>
                  </div>
                  
                  <div className="divide-y divide-gray-200">
                    {customFields.map((field, index) => (
                      <div key={field.id} className="px-4 py-3 hover:bg-gray-50">
                        <div className="grid grid-cols-12 gap-4 items-center">
                          <div className="col-span-4">
                            <div className="font-medium text-sm text-gray-900">{field.name}</div>
                            <div className="text-xs text-gray-500">{field.description || 'No description'}</div>
                          </div>
                          
                          <div className="col-span-1 text-center">
                            <svg className="w-4 h-4 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          </div>
                          
                          <div className="col-span-4">
                            <select
                              value={(() => {
                                const mapping = fieldMappings.find(m => m.custom_field_id === field.id)
                                const value = mapping?.source_field || ''
                                if (mapping) {
                                  console.log(`🔍 Field "${field.name}" (ID: ${field.id}):`)
                                  console.log('  - Found mapping:', mapping)
                                  console.log('  - Dropdown value:', value)
                                }
                                return value
                              })()}
                              onChange={(e) => handleFieldMapping(field.id, e.target.value)}
                              className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                              <option value="">Select source field</option>
                              {sourceFields.map((sourceField) => (
                                <option key={sourceField} value={sourceField}>
                                  {sourceField}
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          <div className="col-span-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {field.datatype}
                            </span>
                          </div>
                          
                          <div className="col-span-1 text-center">
                            {fieldMappings.find(m => m.custom_field_id === field.id) ? (
                              <button
                                onClick={() => handleFieldMapping(field.id, '')}
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
                    ))}
                  </div>
                </div>

                {/* Available Source Fields */}
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-gray-900 mb-3">Available Source Fields</h4>
                  {sourceFields.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {sourceFields.map((field) => {
                        const isMapped = fieldMappings.some(m => m.source_field === field)
                        return (
                          <span
                            key={field}
                            className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
                              isMapped 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {field}
                            {isMapped && (
                              <svg className="w-3 h-3 ml-1" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </span>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-yellow-800">
                            No Source Fields Available
                          </h3>
                          <div className="mt-2 text-sm text-yellow-700">
                            <p>
                              Source fields could not be loaded. This might happen if:
                            </p>
                            <ul className="list-disc list-inside mt-1 space-y-1">
                              <li>The supplier source is not accessible</li>
                              <li>No data has been imported yet</li>
                              <li>The data format is not supported</li>
                            </ul>
                            <p className="mt-2">
                              Try importing data first using the <strong>Add Supplier</strong> wizard.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Mapping Summary */}
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="text-sm font-medium text-blue-900">Total Custom Fields</div>
                    <div className="text-2xl font-bold text-blue-600">{customFields.length}</div>
                  </div>
                  
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="text-sm font-medium text-green-900">Mapped Fields</div>
                    <div className="text-2xl font-bold text-green-600">{fieldMappings.length}</div>
                  </div>
                  
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                    <div className="text-sm font-medium text-orange-900">Available Source Fields</div>
                    <div className="text-2xl font-bold text-orange-600">{sourceFields.length}</div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-6 flex justify-between items-center">
                  <button
                    onClick={() => window.open('/fields', '_blank')}
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    Manage Custom Fields
                  </button>
                  
                  <div className="flex items-center space-x-4">
                    {fieldMappings.length === 0 && (
                      <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        ⚠️ No fields mapped yet.
                      </div>
                    )}
                    
                    <button
                      onClick={handleSaveMappings}
                      disabled={saving}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {saving ? 'Saving...' : 'Save Mappings'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}