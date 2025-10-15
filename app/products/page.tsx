'use client'

import { useEffect, useMemo, useState } from 'react'
import { useWorkspace } from '@/lib/workspaceContext'

type Product = {
  id: string
  uid: string
  name: string
  ean?: string
  price?: number | null
  supplier_id: string
  supplier_name: string
  imported_at?: string
}

export default function ProductsPage() {
  const { activeWorkspaceId } = useWorkspace()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [page, setPage] = useState(1)
  const [limit] = useState(25)
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [supplierId, setSupplierId] = useState<string>('')

  useEffect(() => {
    if (activeWorkspaceId) fetchProducts(1)
  }, [activeWorkspaceId])

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

  return (
    <div className="p-6 products-page">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Products</h2>
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name / SKU / EAN"
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
          <div className="relative">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">UID</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">EAN</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-56">Supplier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-56">Imported</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{p.uid}</td>
                    <td className="px-4 py-3 text-sm text-gray-900">{p.name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{p.ean || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatPrice(p.price)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{p.supplier_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{formatTs(p.imported_at)}</td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">No products</td>
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


