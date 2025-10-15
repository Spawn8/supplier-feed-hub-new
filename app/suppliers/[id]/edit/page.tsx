'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabaseClient'
import CategoryMappingInterface from '@/components/CategoryMappingInterface'
import { useWorkspace } from '@/lib/workspaceContext'

interface Supplier {
  id: string
  name: string
  description?: string
  source_type: 'url' | 'upload'
  endpoint_url?: string
  auth_username?: string
  schedule_cron?: string
  schedule_enabled: boolean
  status: 'active' | 'paused' | 'error'
  workspace_id: string
  settings?: {
    uid_source_key?: string
  }
}

interface FieldMapping {
  custom_field_id: string
  source_field: string
}

export default function EditSupplierPage() {
  const { activeWorkspaceId } = useWorkspace()
  const [user, setUser] = useState<any>(null)
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [mappingLoading, setMappingLoading] = useState(false)
  const [mappingLoaded, setMappingLoaded] = useState(false)
  
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const supplierId = params.id as string
  
  // Tab routing helpers: support deep-link values and back-compat
  const tabParamToState = useCallback((value: string | null): 'details' | 'mapping' | 'category-mapping' => {
    if (!value) return 'details'
    if (value === 'supplier-details' || value === 'details') return 'details'
    if (value === 'field-mapping' || value === 'mapping') return 'mapping'
    if (value === 'category-mapping') return 'category-mapping'
    return 'details'
  }, [])

  const stateToTabParam = useCallback((value: 'details' | 'mapping' | 'category-mapping'): string => {
    if (value === 'details') return 'supplier-details'
    if (value === 'mapping') return 'field-mapping'
    return 'category-mapping'
  }, [])

  // Get tab from URL params, default to 'details'
  const [activeTab, setActiveTab] = useState<'details' | 'mapping' | 'category-mapping'>(
    tabParamToState(searchParams.get('tab'))
  )
  
  // Details form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    source_type: 'url' as 'url' | 'upload',
    endpoint_url: '',
    auth_username: '',
    auth_password: '',
    schedule_cron: '',
    schedule_enabled: false
  })
  
  
  // Field mapping state
  const [customFields, setCustomFields] = useState<any[]>([])
  const [sourceFields, setSourceFields] = useState<string[]>([])
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([])
  const [originalMappings, setOriginalMappings] = useState<FieldMapping[]>([])

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (user && supplierId && activeWorkspaceId) {
      fetchData()
    }
  }, [user, supplierId, activeWorkspaceId])


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
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      await fetchSupplier()
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Failed to load supplier data')
    } finally {
      setLoading(false)
    }
  }

  const fetchSupplier = async () => {
    try {
      const response = await fetch(`/api/suppliers/${supplierId}/details?workspace_id=${activeWorkspaceId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load supplier')
      }

      setSupplier(data.supplier)
      setFormData({
        name: data.supplier.name || '',
        description: data.supplier.description || '',
        source_type: data.supplier.source_type || 'url',
        endpoint_url: data.supplier.endpoint_url || '',
        auth_username: data.supplier.auth_username || '',
        auth_password: '',
        schedule_cron: data.supplier.schedule_cron || '',
        schedule_enabled: data.supplier.schedule_enabled || false
      })
    } catch (err) {
      console.error('Error fetching supplier:', err)
      setError('Failed to load supplier')
    }
  }

  const loadFieldMappingData = async () => {
    if (!activeWorkspaceId || mappingLoaded) return
    try {
      setMappingLoading(true)
      // Fetch data needed for field mapping tab only when opened
      await fetchCustomFields()
      await fetchExistingMappings()
      await fetchSourceFields(supplier)
      setMappingLoaded(true)
    } catch (e) {
      // Errors are handled inside called functions
    } finally {
      setMappingLoading(false)
    }
  }

  // Load mapping data when switching to mapping tab
  useEffect(() => {
    if (activeTab === 'mapping') {
      loadFieldMappingData()
    }
  }, [activeTab, activeWorkspaceId, supplierId])

  // Sync tab state with search params to support deep-links and back/forward
  useEffect(() => {
    const urlTab = tabParamToState(searchParams.get('tab'))
    setActiveTab(urlTab)
  }, [searchParams, tabParamToState])

  const switchTab = useCallback((nextTab: 'details' | 'mapping' | 'category-mapping') => {
    setActiveTab(nextTab)
    const params = new URLSearchParams(Array.from(searchParams.entries()))
    params.set('tab', stateToTabParam(nextTab))
    // Preserve path and other params, avoid scroll jumps
    router.push(`?${params.toString()}`, { scroll: false })
  }, [router, searchParams, stateToTabParam])

  // Preload field mapping data once supplier and workspace are known
  useEffect(() => {
    if (supplier && activeWorkspaceId && !mappingLoaded && !mappingLoading) {
      loadFieldMappingData()
    }
  }, [supplier, activeWorkspaceId])

  const fetchCustomFields = async () => {
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
      const response = await fetch(`/api/suppliers/${supplierId}/sample-keys?workspace_id=${activeWorkspaceId}`)
      const data = await response.json()
      
      if (response.ok && data.keys && Array.isArray(data.keys)) {
        setSourceFields(data.keys)
      } else {
        // Try fallback: get fields from raw data
        await fetchSourceFieldsFromRawData()
      }
    } catch (err) {
      console.error('Error fetching source fields:', err)
      await fetchSourceFieldsFromRawData()
    }
  }

  const fetchSourceFieldsFromRawData = async () => {
    try {
      const response = await fetch(`/api/suppliers/${supplierId}/raw-data?page=1&limit=1`)
      const data = await response.json()
      
      if (response.ok && data.supplier?.products?.length > 0) {
        const firstProduct = data.supplier.products[0]
        const rawData = firstProduct.raw || firstProduct
        const fields = Object.keys(rawData).filter(key => 
          !['id', 'uid', 'created_at', 'updated_at'].includes(key)
        ).sort()
        
        if (fields.length > 0) {
          setSourceFields(fields)
        }
      }
    } catch (err) {
      console.error('Error fetching source fields from raw data:', err)
    }
  }

  const fetchExistingMappings = async () => {
    if (!activeWorkspaceId) return
    
    try {
      const response = await fetch(`/api/suppliers/${supplierId}/field-mappings?workspace_id=${activeWorkspaceId}`)
      const data = await response.json()
      
      if (response.ok && data.mappings) {
        const transformedMappings = data.mappings.map((mapping: any) => {
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mapping.field_key)
          let custom_field_id = mapping.field_key
          
          if (!isUUID) {
            const matchingField = customFields.find(f => f.key === mapping.field_key)
            custom_field_id = matchingField ? matchingField.id : mapping.field_key
          }
          
          return {
            custom_field_id: custom_field_id,
            source_field: mapping.source_key || mapping.source_field
          }
        })
        
        setFieldMappings(transformedMappings)
        setOriginalMappings([...transformedMappings])
      }
    } catch (err) {
      console.error('Error fetching existing mappings:', err)
    }
  }

  const handleDetailsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeWorkspaceId || !supplier) return

    try {
      setSaving(true)
      setError(null)

      const response = await fetch(`/api/suppliers/${supplierId}/update-meta`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          workspace_id: activeWorkspaceId
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update supplier')
      }

      setSuccessMessage('Supplier details updated successfully!')
      setSupplier(data.supplier)
      
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      console.error('Error updating supplier:', err)
      setError(err instanceof Error ? err.message : 'Failed to update supplier')
    } finally {
      setSaving(false)
    }
  }

  const handleFieldMapping = (customFieldId: string, sourceField: string) => {
    setFieldMappings(prev => {
      const existing = prev.find(m => m.custom_field_id === customFieldId)
      if (existing) {
        if (sourceField === '') {
          return prev.filter(m => m.custom_field_id !== customFieldId)
        } else {
          return prev.map(m => 
            m.custom_field_id === customFieldId 
              ? { ...m, source_field: sourceField }
              : m
          )
        }
      } else if (sourceField !== '') {
        return [...prev, { custom_field_id: customFieldId, source_field: sourceField }]
      }
      return prev
    })
  }

  const handleMappingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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

      setSuccessMessage('Field mappings updated successfully!')
      setOriginalMappings([...fieldMappings])
      
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      console.error('Error saving mappings:', err)
      setError(err instanceof Error ? err.message : 'Failed to save mappings')
    } finally {
      setSaving(false)
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


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900"></div>
      </div>
    )
  }

  if (!supplier) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Supplier not found</h1>
          <button
            onClick={() => router.push('/suppliers')}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
        {/* Header */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Edit Supplier</h1>
                <p className="mt-2 text-lg text-gray-600">
                  Edit details and field mappings for {supplier.name}
                </p>
              </div>
              <button
                onClick={() => router.push('/suppliers')}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Back to Suppliers
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              <button
                onClick={() => switchTab('details')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'details'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Supplier Details
              </button>
              <button
                onClick={() => switchTab('mapping')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'mapping'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Field Mapping
              </button>
              <button
                onClick={() => switchTab('category-mapping')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'category-mapping'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Category Mapping
              </button>
            </nav>
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
                <p className="text-sm font-medium text-green-800">
                  {successMessage}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-red-800">
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content */}
        <div className="bg-white shadow rounded-lg">
          {activeTab === 'details' && (
            <div className="p-6">
              <form onSubmit={handleDetailsSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Supplier Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter supplier name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Source Type *
                    </label>
                    <select
                      value={formData.source_type}
                      onChange={(e) => setFormData(prev => ({ ...prev, source_type: e.target.value as 'url' | 'upload' }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="url">URL Feed</option>
                      <option value="upload">File Upload</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Optional description"
                  />
                </div>

                {formData.source_type === 'url' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Feed URL *
                      </label>
                      <input
                        type="url"
                        required
                        value={formData.endpoint_url}
                        onChange={(e) => setFormData(prev => ({ ...prev, endpoint_url: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="https://example.com/feed.xml"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Username (optional)
                        </label>
                        <input
                          type="text"
                          value={formData.auth_username}
                          onChange={(e) => setFormData(prev => ({ ...prev, auth_username: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="HTTP Auth username"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Password (optional)
                        </label>
                        <input
                          type="password"
                          value={formData.auth_password}
                          onChange={(e) => setFormData(prev => ({ ...prev, auth_password: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="HTTP Auth password"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.schedule_enabled}
                      onChange={(e) => setFormData(prev => ({ ...prev, schedule_enabled: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                    />
                    <span className="ml-2 text-sm text-gray-700">Enable scheduled imports</span>
                  </label>
                </div>

                {formData.schedule_enabled && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Schedule (Cron Expression)
                    </label>
                    <input
                      type="text"
                      value={formData.schedule_cron}
                      onChange={(e) => setFormData(prev => ({ ...prev, schedule_cron: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="0 0 * * * (daily at midnight)"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Use cron format: minute hour day month weekday
                    </p>
                  </div>
                )}

                {/* UID Source Key Display */}
                <div className="border-t pt-6 mt-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div>
                        <p className="text-sm text-blue-700">
                          <strong>Unique Identifier Field:</strong> {supplier?.settings?.uid_source_key || 'Not set'}
                        </p>
                        {supplier?.settings?.uid_source_key ? (
                          <p className="text-xs text-blue-600 mt-1">
                            This field cannot be changed after the first successful import.
                          </p>
                        ) : (
                          <p className="text-xs text-blue-600 mt-1">
                            This supplier needs a unique identifier field to sync data. Please use the supplier wizard to set this up.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {saving ? 'Updating...' : 'Update Supplier'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className={`p-6 ${activeTab === 'mapping' ? '' : 'hidden'}`}>
            {mappingLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
              </div>
            )}
            {!mappingLoading && (
            <form onSubmit={handleMappingsSubmit} className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Field Mapping</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Map your custom fields to source fields from the supplier feed.
                </p>
              </div>
              
              {customFields.length > 0 ? (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                    <div className="grid grid-cols-12 gap-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <div className="col-span-4">Custom Field</div>
                      <div className="col-span-1"></div>
                      <div className="col-span-4">Source Field</div>
                      <div className="col-span-2">Type</div>
                      <div className="col-span-1">Required</div>
                    </div>
                  </div>
                  
                  <div className="divide-y divide-gray-200">
                    {customFields.map((field) => (
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
                              value={fieldMappings.find(m => m.custom_field_id === field.id)?.source_field || ''}
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
                            {field.is_required && (
                              <span className="text-red-500 text-xs">*</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No custom fields found. Create some custom fields first.</p>
                  <button
                    type="button"
                    onClick={() => router.push('/fields')}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Manage Custom Fields
                  </button>
                </div>
              )}
              
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
                    <p className="text-sm text-yellow-800">
                      No source fields available. Make sure the supplier has data or is accessible.
                    </p>
                  </div>
                )}
              </div>
              
              {/* Mapping Summary */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-sm font-medium text-blue-900">Total Custom Fields</div>
                  <div className="text-2xl font-bold text-blue-900">{customFields.length}</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="text-sm font-medium text-green-900">Mapped Fields</div>
                  <div className="text-2xl font-bold text-green-900">{fieldMappings.length}</div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-sm font-medium text-gray-900">Available Source Fields</div>
                  <div className="text-2xl font-bold text-gray-900">{sourceFields.length}</div>
                </div>
              </div>
              
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Mappings'}
                </button>
              </div>
            </form>
            )}
          </div>
          <div className={`p-6 ${activeTab === 'category-mapping' ? '' : 'hidden'}`}>
            {supplier && (
              <CategoryMappingInterface
                supplierId={supplier.id}
                supplierName={supplier.name}
                inline
                onMappingCreated={() => {}}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
