'use client'

import { useEffect, useMemo, useState } from 'react'
import { useWorkspace } from '@/lib/workspaceContext'

type CustomField = {
  id: string
  name: string
  key: string
  datatype: string
  is_visible: boolean
}

type Product = {
  id: string
  uid: string
  name: string
  ean?: string
  price?: number | null
  supplier_id: string
  supplier_name: string
  imported_at?: string
  fields: Record<string, any>
  [key: string]: any // Allow dynamic custom field properties
}

export default function ProductsPage() {
  const { activeWorkspaceId } = useWorkspace()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [customFields, setCustomFields] = useState<CustomField[]>([])
  const [suppliers, setSuppliers] = useState<Array<{id: string, name: string}>>([])
  const [page, setPage] = useState(1)
  const [limit] = useState(25)
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [supplierId, setSupplierId] = useState<string>('')

  useEffect(() => {
    if (activeWorkspaceId) {
      fetchProducts(1)
      fetchSuppliers()
    }
  }, [activeWorkspaceId])

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers')
      const data = await res.json()
      if (res.ok) {
        setSuppliers(data.suppliers || [])
      }
    } catch (e) {
      console.error('Failed to load suppliers:', e)
    }
  }

  const fetchProducts = async (p = page) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ page: String(p), limit: String(limit) })
      if (q) params.set('q', q)
      if (supplierId) params.set('supplier_id', supplierId)
      const res = await fetch(`/api/products?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load products')
      setProducts(data.products || [])
      setCustomFields(data.customFields || [])
      setTotal(data.pagination?.total || 0)
      setPage(p)
    } catch (e: any) {
      setError(e.message || 'Failed to load products')
    } finally {
      setLoading(false)
    }
  }

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit])

  const formatTs = (s?: string) => (s ? new Date(s).toLocaleString() : '—')
  const formatPrice = (p?: number | null) => (p == null ? '—' : Number(p).toFixed(2))
  const formatValue = (value: any, datatype: string) => {
    if (value === null || value === undefined) return '—'
    if (datatype === 'number') return Number(value).toFixed(2)
    if (datatype === 'bool') return value ? 'Yes' : 'No'
    if (datatype === 'date') return new Date(value).toLocaleDateString()
    if (datatype === 'json') return JSON.stringify(value)
    return String(value)
  }

  // Get display columns - show standard fields plus visible custom fields
  const getDisplayColumns = () => {
    const standardColumns = [
      { key: 'uid', name: 'UID', width: 'w-20' }
    ]
    
    const customColumns = customFields
      .filter(field => field.is_visible)
      .map(field => ({
        key: field.key,
        name: field.name,
        width: 'w-40',
        datatype: field.datatype
      }))
    
    const endColumns = [
      { key: 'supplier_name', name: 'Supplier', width: 'w-56' },
      { key: 'imported_at', name: 'Imported', width: 'w-56' }
    ]
    
    return [...standardColumns, ...customColumns, ...endColumns]
  }

  return (
    <div className="p-6 products-page">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Products</h2>
        <div className="flex gap-2">
          <select
            value={supplierId}
            onChange={(e) => {
              setSupplierId(e.target.value)
              fetchProducts(1)
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Suppliers</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button onClick={() => fetchProducts(1)} className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Search</button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        {loading ? (
          <div className="p-6 text-sm text-gray-500">Loading…</div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {getDisplayColumns().map((column) => (
                    <th key={column.key} className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${column.width}`}>
                      {column.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    {getDisplayColumns().map((column) => {
                      let value: any
                      let displayValue: string
                      
                      if (column.key === 'uid') {
                        value = p.uid
                        displayValue = value
                      } else if (column.key === 'supplier_name') {
                        value = p.supplier_name
                        displayValue = value
                      } else if (column.key === 'imported_at') {
                        value = p.imported_at
                        displayValue = formatTs(value)
                      } else {
                        // Custom field
                        value = p[column.key]
                        displayValue = formatValue(value, column.datatype)
                      }
                      
                      return (
                        <td key={column.key} className="px-4 py-3 text-sm text-gray-700">
                          {displayValue}
                        </td>
                      )
                    })}
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={getDisplayColumns().length} className="px-4 py-6 text-center text-sm text-gray-500">No products</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-gray-600">Page {page} of {totalPages}</div>
        <div className="flex gap-2">
          <button disabled={page<=1} onClick={() => fetchProducts(page-1)} className="px-3 py-1.5 border rounded disabled:opacity-50">Previous</button>
          <button disabled={page>=totalPages} onClick={() => fetchProducts(page+1)} className="px-3 py-1.5 border rounded disabled:opacity-50">Next</button>
        </div>
      </div>
    </div>
  )
}


