'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabaseClient'
import { useWorkspace } from '@/lib/workspaceContext'
import UniversalFieldMapping from '@/components/UniversalFieldMapping'

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

  const handleFieldDrop = (sourceField: string, customFieldId: string) => {
    handleFieldMapping(customFieldId, sourceField)
  }

  const handleFieldCreated = (newField: any) => {
    // Add the new field to the end of the custom fields list
    setCustomFields(prev => [...prev, newField])
  }

  const handleFieldUpdated = (updatedField: any) => {
    // Update the field in the custom fields list
    setCustomFields(prev => prev.map(field => 
      field.id === updatedField.id ? updatedField : field
    ))
  }

  const handleSaveMappings = async () => {
    if (!activeWorkspaceId) return
    
    try {
      setSaving(true)
      setError(null)
      setSuccessMessage('Saving mappings...')
      
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

      // Success - just saved the mappings
      setSuccessMessage('Field mappings saved! Trigger a re-sync to apply changes to products.')
      setOriginalMappings([...fieldMappings])
      
      // Wait a moment to show success message
      setTimeout(() => {
        router.push(`/suppliers?mapping_saved=true&supplier_name=${encodeURIComponent(supplier?.name || 'Supplier')}`)
      }, 2000)
    } catch (err) {
      console.error('Error saving mappings:', err)
      setError(err instanceof Error ? err.message : 'Failed to save mappings')
      setSuccessMessage(null)
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

        {/* Universal Field Mapping Component */}
        <UniversalFieldMapping
          customFields={customFields}
          sourceFields={sourceFields}
          fieldMappings={fieldMappings}
          supplierId={supplierId}
          workspaceId={activeWorkspaceId!}
          onFieldMapping={handleFieldMapping}
          onFieldDrop={handleFieldDrop}
          onFieldCreated={handleFieldCreated}
          onFieldUpdated={handleFieldUpdated}
          showAddNewField={true}
          showEditFields={true}
          showActionButtons={true}
        />

        {/* Save Mappings Button */}
        <div className="mt-6 flex justify-end">
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
  )
}