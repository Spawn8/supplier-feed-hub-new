'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { useWorkspace } from '@/lib/workspaceContext'
import LoadingOverlay from './ui/LoadingOverlay'
import CategoryMappingInterface from '@/components/CategoryMappingInterface'
import UniversalFieldMapping from './UniversalFieldMapping'

interface SupplierWizardProps {
  onSuccess: (supplier: any) => void
  onCancel: () => void
}

interface SupplierData {
  name: string
  description: string
  source_type: 'url' | 'upload'
  endpoint_url: string
  auth_username: string
  auth_password: string
  schedule_cron: string
  schedule_enabled: boolean
  uploaded_file?: File
  settings?: {
    uid_source_key?: string
  }
}

interface FieldMapping {
  custom_field_id: string
  source_field: string
}

export default function SupplierWizard({ onSuccess, onCancel }: SupplierWizardProps) {
  const { activeWorkspaceId } = useWorkspace()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [busy, setBusy] = useState(false)

  const formatFileSize = (bytes: number) => {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    if (bytes >= 1024) return `${Math.ceil(bytes / 1024)} KB`
    return `${bytes} B`
  }
  
  // Step 1: Basic Info
  const [supplierData, setSupplierData] = useState<SupplierData>({
    name: '',
    description: '',
    source_type: 'url',
    endpoint_url: '',
    auth_username: '',
    auth_password: '',
    schedule_cron: '',
    schedule_enabled: false,
    uploaded_file: undefined
  })
  
  // Step 2: Field Mapping
  const [customFields, setCustomFields] = useState<any[]>([])
  const [sourceFields, setSourceFields] = useState<string[]>([])
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([])
  const [createdSupplierId, setCreatedSupplierId] = useState<string | null>(null)

  
  // Step 3: UID Selection
  const [uidSourceKey, setUidSourceKey] = useState<string>('')
  
  // Step 4: Import Results
  const [importResults, setImportResults] = useState<any>(null)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (activeWorkspaceId && (currentStep === 2 || currentStep === 3)) {
      fetchCustomFields()
      fetchSourceFields()
    }
  }, [activeWorkspaceId, currentStep])

  // Resume support: if ?resume={supplierId} is present, preload and jump to the correct step
  const searchParams = useSearchParams()
  useEffect(() => {
    const resumeId = searchParams?.get('resume')
    if (!resumeId || !activeWorkspaceId) return
    ;(async () => {
      try {
        setBusy(true)
        setError(null)
        // 1) Load supplier details
        const detailsRes = await fetch(`/api/suppliers/${resumeId}/details`)
        const detailsJson = await detailsRes.json()
        if (!detailsRes.ok) throw new Error(detailsJson.error || 'Failed to load supplier')

        const s = detailsJson.supplier || detailsJson
        setCreatedSupplierId(resumeId)
        setSupplierData(prev => ({
          ...prev,
          name: s.name || '',
          description: s.description || '',
          source_type: (s.source_type === 'upload' ? 'upload' : 'url'),
          endpoint_url: s.endpoint_url || '',
          auth_username: s.auth_username || '',
          auth_password: s.auth_password || '',
          schedule_cron: s.schedule_cron || '',
          schedule_enabled: !!s.schedule_enabled,
        }))

        // 2) Determine which step to jump to
        let nextStep = 2
        let hasMappings = false
        let hasUid = Boolean(s.settings?.uid_source_key)
        try {
          const mappedRes = await fetch(`/api/suppliers/${resumeId}/mapped-data?limit=1`)
          const mappedJson = await mappedRes.json()
          if (mappedRes.ok) {
            hasMappings = Array.isArray(mappedJson.fieldMappings) && mappedJson.fieldMappings.length > 0
          }
        } catch {}

        if (!hasMappings) nextStep = 2
        else if (!hasUid) nextStep = 4  // Skip category mapping, go to UID selection
        else nextStep = 5  // Go to import & schedule

        // Set the UID source key if it exists
        if (hasUid && s.settings?.uid_source_key) {
          setUidSourceKey(s.settings.uid_source_key)
        }

        setCurrentStep(nextStep)
      } catch (e: any) {
        setError(e?.message || 'Failed to resume wizard')
      } finally {
        setBusy(false)
      }
    })()
  }, [searchParams, activeWorkspaceId])

  const fetchCustomFields = async () => {
    try {
      setBusy(true)
      const response = await fetch(`/api/fields/list?workspace_id=${activeWorkspaceId}`)
      const data = await response.json()
      if (response.ok) {
        setCustomFields(data.fields || [])
      }
    } catch (err) {
    } finally {
      setBusy(false)
    }
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

  const fetchSourceFields = async () => {
    try {
      if (!createdSupplierId) return
      
      
      // If we have an uploaded file, extract fields from it
      if (supplierData.source_type === 'upload' && supplierData.uploaded_file) {
        
        const formData = new FormData()
        formData.append('file', supplierData.uploaded_file)
        formData.append('workspace_id', activeWorkspaceId || '')
        
        setBusy(true)
        const response = await fetch(`/api/suppliers/${createdSupplierId}/extract-fields`, {
          method: 'POST',
          body: formData,
        })
        
        const data = await response.json()
        
        if (response.ok) {
          const extractedFields = data.fields || []
          setSourceFields(extractedFields)
          
          if (extractedFields.length === 0) {
            setError('No fields found in the uploaded file. Please check the file format.')
          }
        } else {
          throw new Error(data.error || 'Failed to extract fields from uploaded file')
        }
      } else if (
        (supplierData.source_type === 'url' && supplierData.endpoint_url) ||
        (supplierData.source_type === 'upload' && !supplierData.uploaded_file && createdSupplierId)
      ) {
        
        // Fetch sample keys from source (URL or stored upload)
        setBusy(true)
        const response = await fetch(`/api/suppliers/${createdSupplierId}/sample-keys?workspace_id=${activeWorkspaceId}`)
        const data = await response.json()
        
        if (response.ok) {
          const extractedFields = data.keys || []
          setSourceFields(extractedFields)
          
          if (extractedFields.length === 0) {
            setError('No fields found in the data source. Please check the URL and format.')
          }
        } else {
          throw new Error(data.error || 'Failed to fetch fields from URL')
        }
      } else {
        setError('Please provide either a file upload or a URL to extract fields from.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract fields from your data source. Please check your file format or URL.')
    } finally {
      setBusy(false)
    }
  }

  const handleStep1Submit = async () => {
    setLoading(true)
    setBusy(true)
    setError(null)

    try {
      if (!activeWorkspaceId) {
        throw new Error('No workspace selected')
      }

      // Use FormData if there's a file upload, otherwise use JSON
      let response: Response
      if (supplierData.source_type === 'upload' && supplierData.uploaded_file) {
        const formData = new FormData()
        formData.append('workspace_id', activeWorkspaceId)
        formData.append('name', supplierData.name)
        formData.append('description', supplierData.description || '')
        formData.append('source_type', supplierData.source_type)
        formData.append('auth_username', supplierData.auth_username || '')
        formData.append('auth_password', supplierData.auth_password || '')
        formData.append('schedule_cron', supplierData.schedule_cron || '')
        formData.append('schedule_enabled', supplierData.schedule_enabled.toString())
        formData.append('file', supplierData.uploaded_file)

        response = await fetch('/api/suppliers/create', {
          method: 'POST',
          body: formData,
        })
      } else {
        response = await fetch('/api/suppliers/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...supplierData,
            workspace_id: activeWorkspaceId
          }),
        })
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create supplier')
      }

        // Store the created supplier ID
        setCreatedSupplierId(data.supplier.id)

        // Move to step 2 (field mapping)
        setCurrentStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create supplier')
    } finally {
      setLoading(false)
      setBusy(false)
    }
  }

  const handleStep2Submit = async () => {
    setLoading(true)
    setBusy(true)
    setError(null)

    try {
      // Save field mappings
      const response = await fetch('/api/suppliers/field-mappings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          supplier_id: createdSupplierId,
          workspace_id: activeWorkspaceId,
          mappings: fieldMappings
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save field mappings')
      }

      // Move to step 3 (import)
      setCurrentStep(3)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save field mappings')
    } finally {
      setLoading(false)
      setBusy(false)
    }
  }

  const handleStep3Submit = async () => {
    // Category mapping step is optional, proceed to UID selection
    setCurrentStep(4)
  }

  const handleStep4Submit = async () => {
    if (!uidSourceKey) {
      setError('Please select a unique identifier field')
      return
    }
    
    if (!createdSupplierId) {
      setError('Supplier not found. Please start over.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Update the supplier with UID source key
      const response = await fetch(`/api/suppliers/${createdSupplierId}/set-uid-source`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uid_source_key: uidSourceKey }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to set UID source key')
      }

      // Set the UID source key in supplier data for display
      setSupplierData(prev => ({
        ...prev,
        settings: {
          ...prev.settings,
          uid_source_key: uidSourceKey
        }
      }))
      
      setCurrentStep(5)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set UID source key')
    } finally {
      setLoading(false)
    }
  }

  const handleStep5Submit = async () => {
    setImporting(true)
    setBusy(true)
    setError(null)

    try {
      // Start import process
      let response: Response
      
      if (supplierData.uploaded_file) {
        // If we have an uploaded file, send it as FormData
        const formData = new FormData()
        formData.append('supplier_id', createdSupplierId || '')
        formData.append('mappings', JSON.stringify(fieldMappings))
        formData.append('file', supplierData.uploaded_file)
        
        response = await fetch('/api/suppliers/import', {
          method: 'POST',
          body: formData,
        })
      } else {
        // If no file, send JSON (this will fail if no URL source is configured)
        response = await fetch('/api/suppliers/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            supplier_id: createdSupplierId,
            mappings: fieldMappings
          }),
        })
      }

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start import')
      }

      setImportResults(data.results)
      // No automatic redirect - let user choose where to go
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import supplier')
    } finally {
      setImporting(false)
      setBusy(false)
    }
  }


  const BusyBanner = () => (
    (busy || loading || importing) ? (
      <div className="w-full flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded">
        <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-blue-700">Please wait…</span>
      </div>
    ) : null
  )

  const renderStep1 = () => (
    <div className="space-y-6">
      <BusyBanner />
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Supplier Name *
            </label>
            <input
              type="text"
              id="name"
              value={supplierData.name}
              onChange={(e) => setSupplierData(prev => ({ ...prev, name: e.target.value }))}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="My Supplier"
            />
          </div>

          <div>
            <label htmlFor="source_type" className="block text-sm font-medium text-gray-700 mb-2">
              Source Type *
            </label>
            <select
              id="source_type"
              value={supplierData.source_type}
              onChange={(e) => setSupplierData(prev => ({ ...prev, source_type: e.target.value as 'url' | 'upload' }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="url">URL Feed</option>
              <option value="upload">File Upload</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            id="description"
            value={supplierData.description}
            onChange={(e) => setSupplierData(prev => ({ ...prev, description: e.target.value }))}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Brief description of this supplier..."
          />
        </div>

        {supplierData.source_type === 'url' && (
          <>
            <div className="mt-4">
              <label htmlFor="endpoint_url" className="block text-sm font-medium text-gray-700 mb-2">
                Endpoint URL *
              </label>
              <input
                type="url"
                id="endpoint_url"
                value={supplierData.endpoint_url}
                onChange={(e) => setSupplierData(prev => ({ ...prev, endpoint_url: e.target.value }))}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://example.com/products.xml"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label htmlFor="auth_username" className="block text-sm font-medium text-gray-700 mb-2">
                  Username (Optional)
                </label>
                <input
                  type="text"
                  id="auth_username"
                  value={supplierData.auth_username}
                  onChange={(e) => setSupplierData(prev => ({ ...prev, auth_username: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="username"
                />
              </div>

              <div>
                <label htmlFor="auth_password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password (Optional)
                </label>
                <input
                  type="password"
                  id="auth_password"
                  value={supplierData.auth_password}
                  onChange={(e) => setSupplierData(prev => ({ ...prev, auth_password: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </>
        )}

        {supplierData.source_type === 'upload' && (
          <div className="mt-4">
            <label htmlFor="file_upload" className="block text-sm font-medium text-gray-700 mb-2">
              Upload File *
            </label>
            <div
              className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
                isDragging ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
              } ${supplierData.uploaded_file ? 'border-green-400 bg-green-50' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false)
                const file = e.dataTransfer?.files?.[0]
                if (file) {
                  if (file.size > 500 * 1024 * 1024) {
                    setError('File too large. Maximum allowed is 500 MB.')
                    return
                  }
                  setSupplierData(prev => ({ ...prev, uploaded_file: file }))
                }
              }}
              onClick={() => (document.getElementById('file_upload') as HTMLInputElement | null)?.click()}
            >
              <div className="space-y-1 text-center select-none">
                <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <div className="flex text-sm text-gray-600 justify-center items-center">
                  <span className="relative bg-white rounded-md font-medium text-blue-600 hover:text-blue-500">
                    {supplierData.uploaded_file ? 'Change file' : 'Upload a file'}
                  </span>
                  <input
                    id="file_upload"
                    name="file_upload"
                    type="file"
                    accept=".xml,.csv,.json"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        if (file.size > 500 * 1024 * 1024) {
                          setError('File too large. Maximum allowed is 500 MB.')
                          ;(e.target as HTMLInputElement).value = ''
                          return
                        }
                        setSupplierData(prev => ({ ...prev, uploaded_file: file }))
                      }
                    }}
                    className="sr-only"
                  />
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">XML, CSV, or JSON files up to 500MB</p>
              </div>
            </div>
            {supplierData.uploaded_file && (
              <div className="mt-3 flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                  <span className="font-medium">{supplierData.uploaded_file.name}</span>
                  <span className="text-green-600/70">({formatFileSize(supplierData.uploaded_file.size)})</span>
                </div>
                <button
                  onClick={() => setSupplierData(prev => ({ ...prev, uploaded_file: undefined }))}
                  className="text-sm text-green-700 hover:text-green-900 underline"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-6">
      <BusyBanner />
      
      {fieldMappings.length === 0 && sourceFields.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-medium text-yellow-800">Field Mapping Required</p>
              <p className="text-sm text-yellow-700">Please map at least one custom field to a source field to continue.</p>
            </div>
          </div>
        </div>
      )}
      
      
      {/* Universal Field Mapping Component */}
      <UniversalFieldMapping
        customFields={customFields}
        sourceFields={sourceFields}
        fieldMappings={fieldMappings}
        supplierId={createdSupplierId || ''}
        workspaceId={activeWorkspaceId!}
        onMappingsChange={setFieldMappings}
        onFieldCreated={handleFieldCreated}
        onFieldUpdated={handleFieldUpdated}
        showAddNewField={true}
        showEditFields={true}
        showActionButtons={false}
      />

      {/* Warning for no mappings */}
      {fieldMappings.length === 0 && (
        <div className="mt-6 flex justify-center">
          <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            ⚠️ No fields mapped yet. Please map at least one field to continue.
          </div>
        </div>
      )}
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-6">
      <BusyBanner />
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Category Mapping (Optional)</h3>
        <p className="text-sm text-gray-600 mb-6">
          Map supplier categories to your workspace categories. This step is optional - you can skip it now and set it up later from the supplier edit page.
        </p>

        {createdSupplierId ? (
          <div className="bg-white rounded-lg">
            <CategoryMappingInterface
              supplierId={createdSupplierId}
              supplierName={supplierData.name || 'Supplier'}
              inline
              sourceFields={sourceFields}
              onMappingCreated={(mapping) => {
                console.log('Category mapping created:', mapping)
              }}
            />
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-700">Supplier must be created before setting up category mappings.</p>
          </div>
        )}
      </div>
    </div>
  )

  const renderStep4 = () => (
    <div className="space-y-6">
      <BusyBanner />
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Unique Identifier Selection</h3>
        <p className="text-sm text-gray-600 mb-4">Select a field from your supplier's data that will serve as the unique identifier for products. This field will be used to determine if a product is new or an update to an existing product.</p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-blue-800">Why is this important?</p>
              <p className="text-sm text-blue-700">The unique identifier ensures that when you re-import data, existing products are updated instead of creating duplicates.</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="uid_source_key" className="block text-sm font-medium text-gray-700 mb-2">
              Select Unique Identifier Field *
            </label>
            <select
              id="uid_source_key"
              value={uidSourceKey}
              onChange={(e) => setUidSourceKey(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Choose a field...</option>
              {sourceFields.map((field) => (
                <option key={field} value={field}>
                  {field}
                </option>
              ))}
            </select>
            {uidSourceKey && (
              <p className="mt-2 text-sm text-green-600">
                ✓ Products will be identified using the "{uidSourceKey}" field
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  const renderStep5 = () => (
    <div className="space-y-6">
      <BusyBanner />
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Import & Schedule</h3>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-blue-700">
              Ready to import products from {supplierData.name} using "{uidSourceKey}" as unique identifier
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center">
            <input
              type="checkbox"
              id="schedule_enabled"
              checked={supplierData.schedule_enabled}
              onChange={(e) => setSupplierData(prev => ({ ...prev, schedule_enabled: e.target.checked }))}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="schedule_enabled" className="ml-2 text-sm text-gray-700">
              Enable automatic syncing
            </label>
          </div>

          {supplierData.schedule_enabled && (
            <div>
              <label htmlFor="schedule_cron" className="block text-sm font-medium text-gray-700 mb-2">
                Sync Frequency
              </label>
              <select
                id="schedule_cron"
                value={supplierData.schedule_cron}
                onChange={(e) => setSupplierData(prev => ({ ...prev, schedule_cron: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Manual only</option>
                <option value="0 */1 * * *">Every hour</option>
                <option value="0 0 */6 * *">Every 6 hours</option>
                <option value="0 0 */12 * *">Every 12 hours</option>
                <option value="0 0 * * *">Daily at midnight</option>
                <option value="0 0 3 * *">Daily at 3:00 AM</option>
                <option value="0 0 * * 0">Weekly on Sunday</option>
                <option value="0 0 1 * *">Monthly on 1st</option>
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const renderImportResults = () => (
    <div className="space-y-6">
      <div>
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Import Complete</h2>
          <p className="text-gray-600">Your supplier has been successfully imported and is ready to use.</p>
        </div>
        
        {importing ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Processing your data...</p>
            <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
          </div>
        ) : importResults ? (
          <div className="space-y-4">
            {/* Success Header */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-green-900">Import Completed Successfully!</h4>
                  <p className="text-sm text-green-700">Your supplier data has been processed and imported</p>
                </div>
              </div>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg p-4 border border-green-200">
                  <div className="text-2xl font-bold text-green-600">{importResults.total_products}</div>
                  <div className="text-sm text-green-700">Total Products</div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-green-200">
                  <div className="text-2xl font-bold text-green-600">{importResults.new_products}</div>
                  <div className="text-sm text-green-700">New Products</div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-green-200">
                  <div className="text-2xl font-bold text-green-600">{importResults.errors || 0}</div>
                  <div className="text-sm text-green-700">Errors</div>
                </div>
                <div className="bg-white rounded-lg p-4 border border-green-200">
                  <div className="text-2xl font-bold text-green-600">
                    {importResults.duration_ms ? `${(importResults.duration_ms / 1000).toFixed(1)}s` : '0.1s'}
                  </div>
                  <div className="text-sm text-green-700">Duration</div>
                </div>
              </div>
            </div>
            
            {/* Navigation Buttons */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <h4 className="text-lg font-medium text-gray-900 mb-4">What would you like to do next?</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* View Raw Data */}
                <button
                  onClick={() => {
                    if (createdSupplierId) {
                      window.location.href = `/suppliers/${createdSupplierId}/raw`
                    }
                  }}
                  className="flex flex-col items-center p-4 bg-white border border-gray-300 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                >
                  <svg className="w-8 h-8 text-blue-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="font-medium text-gray-900">View Raw Data</span>
                  <span className="text-sm text-gray-500 text-center mt-1">See the imported products as they were received</span>
                </button>

                {/* View Mapped Data */}
                <button
                  onClick={() => {
                    if (createdSupplierId) {
                      window.location.href = `/suppliers/${createdSupplierId}/mapped`
                    }
                  }}
                  className="flex flex-col items-center p-4 bg-white border border-gray-300 rounded-lg hover:bg-green-50 hover:border-green-300 transition-colors"
                >
                  <svg className="w-8 h-8 text-green-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <span className="font-medium text-gray-900">View Mapped Data</span>
                  <span className="text-sm text-gray-500 text-center mt-1">See products with your field mappings applied</span>
                </button>

                {/* Back to Suppliers */}
                <button
                  onClick={() => {
                    window.location.href = '/suppliers'
                  }}
                  className="flex flex-col items-center p-4 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors"
                >
                  <svg className="w-8 h-8 text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  <span className="font-medium text-gray-900">Back to Suppliers</span>
                  <span className="text-sm text-gray-500 text-center mt-1">Return to the suppliers list</span>
                </button>
              </div>

              {/* Additional Actions */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <div className="flex justify-center space-x-4">
                  <button
                    onClick={() => {
                      if (createdSupplierId) {
                        window.location.href = `/suppliers/${createdSupplierId}/map`
                      }
                    }}
                    className="px-4 py-2 text-sm font-medium text-blue-600 bg-white border border-blue-300 rounded-md hover:bg-blue-50 transition-colors"
                  >
                    Edit Field Mappings
                  </button>
                  <button
                    onClick={() => {
                      // Create a new supplier
                      window.location.href = '/suppliers/new'
                    }}
                    className="px-4 py-2 text-sm font-medium text-green-600 bg-white border border-green-300 rounded-md hover:bg-green-50 transition-colors"
                  >
                    Add Another Supplier
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-center space-x-6">
        {[1, 2, 3, 4, 5].map((step) => (
          <div key={step} className="flex items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              currentStep >= step 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-600'
            }`}>
              {step}
            </div>
            {step < 5 && (
              <div className={`w-12 h-1 mx-3 ${
                currentStep > step 
                  ? 'bg-blue-600' 
                  : 'bg-gray-200'
              }`} />
            )}
          </div>
        ))}
        
        {/* Completion Step - Always visible */}
        <div className="flex items-center ml-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            importResults 
              ? 'bg-green-600 text-white'  // Green when completed
              : 'bg-gray-200 text-gray-600'  // Gray during wizard
          }`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
            {currentStep === 4 && renderStep4()}
            {currentStep === 5 && !importing && !importResults && renderStep5()}
            {(importing || importResults) && renderImportResults()}
      </div>

      {/* Navigation Buttons - Hide when import is complete */}
      {!importing && !importResults && (
        <div className="flex justify-between">
          <button
            onClick={onCancel}
            className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            disabled={loading}
          >
            Cancel
          </button>

          <div className="flex space-x-3">
            {currentStep > 1 && (
              <button
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                disabled={loading}
              >
                Previous
              </button>
            )}

            {currentStep < 5 ? (
              <button
                onClick={() => {
                  if (currentStep === 1) handleStep1Submit()
                  else if (currentStep === 2) handleStep2Submit()
                  else if (currentStep === 3) handleStep3Submit()
                  else if (currentStep === 4) handleStep4Submit()
                }}
                disabled={
                  loading || 
                  !supplierData.name.trim() || 
                  (supplierData.source_type === 'url' && !supplierData.endpoint_url.trim()) || 
                  // For upload: allow proceeding if fields are extracted (resume case)
                  (supplierData.source_type === 'upload' && !supplierData.uploaded_file && sourceFields.length === 0) ||
                  (currentStep === 2 && fieldMappings.length === 0) ||
                  (currentStep === 4 && !uidSourceKey)
                }
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Processing...' : 'Next'}
              </button>
            ) : (
              <button
                onClick={handleStep5Submit}
                disabled={importing}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {importing ? 'Importing...' : 'Complete Import'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Global Loading Overlay */}
      <LoadingOverlay 
        isVisible={busy || loading || importing} 
        message="Working… Please wait" 
      />


    </div>
  )
}
