'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import SkeletonLoader from '@/components/ui/SkeletonLoader'

interface MappedProduct {
  id: string
  uid: string
  fields: Record<string, any>
  source_file?: string
  imported_at: string
  ingestion_id: string
}

interface CustomField {
  id: string
  name: string
  key: string
  datatype: string
  sort_order?: number
}

interface MappedPageProps {
  params: Promise<{ id: string }>
}

export default function MappedPage({ params }: MappedPageProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [products, setProducts] = useState<MappedProduct[]>([])
  const [supplier, setSupplier] = useState<any>(null)
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [pagination, setPagination] = useState<any>(null)
  const [latestIngestion, setLatestIngestion] = useState<any>(null)
  const [customFields, setCustomFields] = useState<Map<string, CustomField>>(new Map())
  const [fieldMappings, setFieldMappings] = useState<any[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedProduct, setSelectedProduct] = useState<MappedProduct | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Resolve async params
  useEffect(() => {
    const resolveParams = async () => {
      const resolvedParams = await params
      setSupplierId(resolvedParams.id)
    }
    resolveParams()
  }, [params])

  const fetchMappedData = async (page = 1) => {
    if (!supplierId) return
    
    try {
      setLoading(true)
      const response = await fetch(`/api/suppliers/${supplierId}/mapped-data?page=${page}&limit=50`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch mapped data')
      }

      console.log('📊 Received products:', data.products?.length)
      console.log('🔧 Field mappings:', data.fieldMappings)
      console.log('📋 Custom fields:', data.customFields)
      
      setProducts(data.products)
      setSupplier(data.supplier)
      setPagination(data.pagination)
      setLatestIngestion(data.latestIngestion)
      setCustomFields(new Map(Object.entries(data.customFields || {})))
      setFieldMappings(data.fieldMappings)
      setCurrentPage(page)
    } catch (err) {
      console.error('Error fetching mapped data:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch mapped data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (supplierId) {
      fetchMappedData(1)
    }
  }, [supplierId])

  // Get the field columns to display - only show mapped fields
  const getDisplayColumns = () => {
    // Only show fields that were actually mapped
    const mappedColumns = fieldMappings
      .filter((m: any) => m.source_key && m.field_key)
      .map((m: any) => {
        const cf = customFields.get(m.field_key)
        return {
          fieldId: m.field_key as string,
          sourceKey: m.source_key as string,
          fieldName: getFieldName(m.field_key as string),
          sort_order: cf?.sort_order ?? Number.MAX_SAFE_INTEGER,
          name_for_tiebreak: cf?.name ?? String(m.field_key)
        }
      })
      // Sort by custom field sort_order, then by name for stability
      .sort((a: any, b: any) => {
        if (a.sort_order !== b.sort_order) return (a.sort_order as number) - (b.sort_order as number)
        return a.name_for_tiebreak.localeCompare(b.name_for_tiebreak)
      })

    console.log('🔍 Mapped columns for display (ordered):', mappedColumns)

    return mappedColumns.map(item => item.fieldId)
  }

  const getFieldName = (fieldId: string) => {
    const field = customFields.get(fieldId)
    console.log(`🔍 Getting field name for ${fieldId}:`, field)
    return field ? field.name : fieldId
  }

  // Debug function to log what we're working with
  const debugData = () => {
    console.log('🔍 Debug - Products:', products.length)
    console.log('🔍 Debug - Field mappings:', fieldMappings)
    console.log('🔍 Debug - Custom fields Map:', customFields)
    console.log('🔍 Debug - Custom fields entries:', Array.from(customFields.entries()))
    console.log('🔍 Debug - Display columns:', getDisplayColumns())
    
    if (products.length > 0) {
      console.log('🔍 Debug - First product fields:', products[0].fields)
      console.log('🔍 Debug - Mapped fields only:', getDisplayColumns().map(fieldId => ({
        fieldId,
        fieldName: getFieldName(fieldId),
        value: products[0].fields[fieldId]
      })))
    }
  }

  if (loading && products.length === 0) {
    return (
      <div className="p-6">
        <SkeletonLoader type="table" count={10} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium">Error Loading Mapped Data</h3>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={() => fetchMappedData(currentPage)}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const displayColumns = getDisplayColumns()

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mapped Data</h1>
          <p className="text-gray-600">
            {supplier?.name} - Data after field mapping transformation
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={debugData}
            className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200"
          >
            Debug Data
          </button>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            ← Back
          </button>
        </div>
      </div>

      {/* Import Info */}
      {latestIngestion && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-blue-900">Latest Import</h3>
              <p className="text-sm text-blue-700">
                {latestIngestion.items_success} of {latestIngestion.items_total} products imported successfully
                {latestIngestion.completed_at && (
                  <span className="ml-2">
                    on {new Date(latestIngestion.completed_at).toLocaleString()}
                  </span>
                )}
              </p>
            </div>
            <div className="text-right">
              <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                latestIngestion.status === 'completed' 
                  ? 'bg-green-100 text-green-800' 
                  : latestIngestion.status === 'failed'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {latestIngestion.status}
              </div>
              {latestIngestion.duration_ms && (
                <p className="text-xs text-blue-600 mt-1">
                  {(latestIngestion.duration_ms / 1000).toFixed(1)}s
                </p>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Products Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  UID
                </th>
                {displayColumns.map((fieldId) => (
                  <th key={fieldId} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {getFieldName(fieldId)}
                  </th>
                ))}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Imported
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((product, index) => (
                <tr key={product.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {index + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {product.uid || (index + 1)}
                  </td>
                  {displayColumns.map((fieldId) => (
                    <td key={fieldId} className="px-6 py-4 text-sm text-gray-900">
                      <div className="max-w-xs truncate">
                        {product.fields[fieldId] !== undefined ? (
                          typeof product.fields[fieldId] === 'object' ? (
                            <span className="text-gray-500 italic">
                              {JSON.stringify(product.fields[fieldId])}
                            </span>
                          ) : (
                            String(product.fields[fieldId])
                          )
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </td>
                  ))}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(product.imported_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => setSelectedProduct(product)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      View All
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => fetchMappedData(currentPage - 1)}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => fetchMappedData(currentPage + 1)}
                disabled={currentPage === pagination.totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{((currentPage - 1) * pagination.limit) + 1}</span> to{' '}
                  <span className="font-medium">
                    {Math.min(currentPage * pagination.limit, pagination.total)}
                  </span>{' '}
                  of <span className="font-medium">{pagination.total}</span> results
                </p>
              </div>
              <div className="flex space-x-2">
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  const pageNum = Math.max(1, currentPage - 2) + i
                  if (pageNum > pagination.totalPages) return null
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => fetchMappedData(pageNum)}
                      className={`px-3 py-2 text-sm rounded-md ${
                        pageNum === currentPage
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mapped Data Modal */}
      {selectedProduct && (
        <>
          {/* Background overlay */}
          <div className="fixed inset-0 bg-gray-500 opacity-30 z-50" />
          
          {/* Modal content */}
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[51]">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Mapped Fields: Product #{products.findIndex(p => p.id === selectedProduct.id) + 1}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      // Convert field IDs to field names for JSON
                      const fieldsWithNames = Object.entries(selectedProduct.fields).reduce((acc, [fieldId, value]) => {
                        acc[getFieldName(fieldId)] = value
                        return acc
                      }, {} as Record<string, any>)
                      const jsonData = JSON.stringify(fieldsWithNames, null, 2)
                      navigator.clipboard.writeText(jsonData)
                      // You could add a toast notification here
                    }}
                    className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200 flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy JSON
                  </button>
                  <button
                    onClick={() => {
                      const csvData = Object.entries(selectedProduct.fields)
                        .map(([key, value]) => `${getFieldName(key)}: ${value}`)
                        .join('\n')
                      navigator.clipboard.writeText(csvData)
                    }}
                    className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded hover:bg-green-200 flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy Text
                  </button>
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            <div className="p-6 overflow-y-auto">
              <div className="space-y-4">
                {Object.entries(selectedProduct.fields).map(([fieldId, value]) => (
                  <div key={fieldId} className="border-b border-gray-100 pb-3">
                    <div className="text-sm text-gray-900">
                      <span className="font-medium">{getFieldName(fieldId)}:</span>
                      <span className="ml-2 text-gray-600">
                        {typeof value === 'object' ? (
                          <pre className="bg-gray-50 p-2 rounded text-xs overflow-x-auto inline-block">
                            {JSON.stringify(value, null, 2)}
                          </pre>
                        ) : (
                          String(value)
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        </>
      )}

      {/* Empty State */}
      {products.length === 0 && !loading && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No mapped data found</h3>
          <p className="mt-1 text-sm text-gray-500">
            This supplier hasn't processed any field mappings yet.
          </p>
        </div>
      )}
    </div>
  )
}