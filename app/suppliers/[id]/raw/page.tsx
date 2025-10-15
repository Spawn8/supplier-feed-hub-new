'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabaseClient'
import { useWorkspace } from '@/lib/workspaceContext'
import SkeletonLoader from '@/components/ui/SkeletonLoader'

export default function SupplierRawPage() {
  const { activeWorkspaceId } = useWorkspace()
  const [user, setUser] = useState<any>(null)
  const [supplier, setSupplier] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const router = useRouter()
  const params = useParams()
  const supplierId = params.id as string

  useEffect(() => {
    setMounted(true)
    checkUser()
  }, [])

  useEffect(() => {
    if (user && supplierId && activeWorkspaceId) {
      fetchSupplier()
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
    } finally {
      setLoading(false)
    }
  }

  const fetchSupplier = async () => {
    if (!activeWorkspaceId) return
    
    try {
      setLoading(true)
      console.log('🔍 Fetching raw data for supplier:', supplierId)
      
      const response = await fetch(`/api/suppliers/${supplierId}/raw-data?page=1&limit=50`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()
      console.log('📋 Raw data response:', data)

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load raw data')
      }

      // Handle both success and error cases from new API
      if (data.supplier) {
        setSupplier(data.supplier)
      } else if (data.error) {
        throw new Error(data.error)
      } else {
        throw new Error('Invalid response format')
      }
    } catch (err) {
      console.error('Error fetching raw data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load raw data')
    } finally {
      setLoading(false)
    }
  }

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return <SkeletonLoader type="page" />
  }

  if (loading) {
    return <SkeletonLoader type="page" />
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
    <div className="min-h-screen bg-gray-50" suppressHydrationWarning={true}>
      <div className="p-6">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{supplier.name || 'Supplier'}</h1>
              <p className="mt-2 text-lg text-gray-600">
                {supplier.live_data ? 'Live raw product data' : 'Raw product data'} - {supplier.total_products || 0} products
                {supplier.live_data && supplier.fetched_at && (
                  <span className="text-sm text-blue-600 ml-2">
                    (fetched {new Date(supplier.fetched_at).toLocaleString()})
                  </span>
                )}
              </p>
              {supplier.fetch_error && (
                <p className="mt-1 text-sm text-red-600">
                  ⚠️ {supplier.fetch_error}
                </p>
              )}
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

        {/* Live Data Info */}
        {supplier.live_data && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-green-900">Live Data</h3>
                <p className="text-sm text-green-700">
                  Showing current data from {supplier.source_type === 'url' ? 'URL source' : 'uploaded file'}
                  {supplier.endpoint_url && (
                    <span className="block text-xs text-green-600 mt-1">
                      Source: {supplier.endpoint_url}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => fetchSupplier()}
                  disabled={loading}
                  className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Refreshing...' : 'Refresh Data'}
                </button>
                <div className="text-right">
                  <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Live
                  </div>
                  <p className="text-xs text-green-600 mt-1">
                    {new Date(supplier.fetched_at).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Fetch Error Info */}
        {supplier.fetch_error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="font-medium text-red-900">Failed to Fetch Data</h3>
                <p className="text-sm text-red-700">
                  Unable to fetch data from {supplier.source_type === 'url' ? 'URL source' : 'uploaded file'}
                  {supplier.endpoint_url && (
                    <span className="block text-xs text-red-600 mt-1">
                      Source: {supplier.endpoint_url}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex items-center space-x-3">
                {supplier.source_type === 'url' && (
                  <button
                    onClick={() => fetchSupplier()}
                    disabled={loading}
                    className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? 'Retrying...' : 'Retry Fetch'}
                  </button>
                )}
                <div className="text-right">
                  <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    Failed
                  </div>
                  <p className="text-xs text-red-600 mt-1">
                    {supplier.fetched_at ? new Date(supplier.fetched_at).toLocaleString() : new Date().toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Products Table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {supplier.products && supplier.products.length > 0 ? (
            (() => {
              // Build field keys preserving XML order across products
              // Start with the first product's key order, then append any new keys as encountered
              const fieldKeys: string[] = []
              supplier.products.forEach((product: any) => {
                const rawData = product.raw || product
                Object.keys(rawData).forEach((key) => {
                  if (!fieldKeys.includes(key)) {
                    fieldKeys.push(key)
                  }
                })
              })

              return (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        {/* Row number column - always first */}
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          #
                        </th>
                        {/* Dynamic columns from XML field keys in original order */}
                        {fieldKeys.map((fieldKey) => (
                          <th 
                            key={fieldKey}
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap"
                          >
                            {fieldKey}
                          </th>
                        ))}
                        {/* Fixed Actions column */}
                        <th className="sticky right-0 bg-gray-50 px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-l border-gray-200">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {supplier.products.map((product: any, index: number) => {
                        const rawData = product.raw || product
                        return (
                          <tr key={product.id || index} className="hover:bg-gray-50">
                            {/* Row number cell - always first */}
                            <td className="px-4 py-4 text-sm text-gray-700 whitespace-nowrap">
                              {index + 1}
                            </td>
                            {/* Dynamic data cells from XML in original order */}
                            {fieldKeys.map((fieldKey) => (
                              <td 
                                key={fieldKey}
                                className="px-4 py-4 text-sm text-gray-900 whitespace-nowrap"
                              >
                                <div className="max-w-xs truncate" title={String(rawData[fieldKey] || '')}>
                                  {rawData[fieldKey] !== undefined && rawData[fieldKey] !== null ? (
                                    typeof rawData[fieldKey] === 'object' ? (
                                      <span className="text-gray-500 italic text-xs">
                                        {JSON.stringify(rawData[fieldKey])}
                                      </span>
                                    ) : (
                                      String(rawData[fieldKey])
                                    )
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </div>
                              </td>
                            ))}
                            {/* Fixed Actions cell */}
                            <td className="sticky right-0 bg-white px-6 py-4 whitespace-nowrap text-sm font-medium border-l border-gray-200">
                              <button
                                onClick={() => setSelectedProduct(product)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                View Raw
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            })()
          ) : (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m13-8l-4 4m0 0l-4-4m4 4V3" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                {supplier.fetch_error ? 'Failed to fetch data' : 'No raw data found'}
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {supplier.fetch_error 
                  ? supplier.fetch_error
                  : supplier.source_type === 'upload' 
                    ? 'Uploaded file data is not stored for live viewing.'
                    : 'Unable to fetch data from the supplier source.'
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Raw Data Modal */}
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
                  Raw Product Data: {selectedProduct.title || selectedProduct.uid || 'Product'}
                </h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const jsonData = JSON.stringify(selectedProduct.raw || selectedProduct, null, 2)
                      navigator.clipboard.writeText(jsonData)
                    }}
                    className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded hover:bg-blue-200 flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    Copy JSON
                  </button>
                  <button
                    onClick={() => {
                      const obj = selectedProduct.raw || selectedProduct
                      const text = Object.entries(obj)
                        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
                        .join('\n')
                      navigator.clipboard.writeText(text)
                    }}
                    className="px-3 py-1 bg-green-100 text-green-700 text-sm rounded hover:bg-green-200 flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
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
                <div className="border-b border-gray-100 pb-3">
                  <div className="text-sm font-medium text-gray-900 mb-1">Complete Raw Data</div>
                  <pre className="bg-gray-50 p-4 rounded text-xs overflow-x-auto text-gray-800 whitespace-pre-wrap">
                    {JSON.stringify(selectedProduct.raw || selectedProduct, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
            {/* Footer removed to match mapped data popup */}
          </div>
        </div>
        </>
      )}
    </div>
  )
}