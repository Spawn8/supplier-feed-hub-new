import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'

export default async function SupplierRawPage({ params }: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <div className="p-8">Please <Link href="/login" className="text-blue-600">log in</Link>.</div>

  const wsId = await getCurrentWorkspaceId()
  if (!wsId) return <div className="p-8">No workspace selected.</div>

  const supplierId = params.id

  const { data: rows, error } = await supabase
    .from('products_raw')
    .select('id, external_id, ean, sku, title, price, currency, category, brand, image_url, imported_at')
    .eq('workspace_id', wsId)
    .eq('supplier_id', supplierId)
    .order('imported_at', { ascending: false })
    .limit(200)

  if (error) {
    return (
      <main className="p-8">
        <div className="rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2">
          {error.message}
        </div>
      </main>
    )
  }

  return (
    <main className="p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Raw items</h1>
          <Link href="/suppliers" className="btn">Back to suppliers</Link>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead className="thead">
              <tr>
                <th className="th">Ext ID</th>
                <th className="th">SKU</th>
                <th className="th">EAN</th>
                <th className="th">Title</th>
                <th className="th">Price</th>
                <th className="th">Category</th>
                <th className="th">Brand</th>
                <th className="th">Imported</th>
              </tr>
            </thead>
            <tbody>
              {(rows || []).map(r => (
                <tr key={r.id} className="border-b last:border-b-0">
                  <td className="td">{r.external_id || '—'}</td>
                  <td className="td">{r.sku || '—'}</td>
                  <td className="td">{r.ean || '—'}</td>
                  <td className="td">{r.title || '—'}</td>
                  <td className="td">{r.price != null ? `${r.price} ${r.currency || ''}` : '—'}</td>
                  <td className="td">{r.category || '—'}</td>
                  <td className="td">{r.brand || '—'}</td>
                  <td className="td">{new Date(r.imported_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(!rows || rows.length === 0) && (
          <div className="text-muted">No items found for this supplier.</div>
        )}
      </div>
    </main>
  )
}
