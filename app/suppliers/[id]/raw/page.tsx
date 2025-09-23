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

  const [{ data: fields }, { data: items, error }] = await Promise.all([
    supabase
      .from('custom_fields')
      .select('id, name, key, sort_order')
      .eq('workspace_id', wsId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('products_mapped')
      .select('id, uid, fields, imported_at')   // <-- uid kept for dedupe, not displayed
      .eq('workspace_id', wsId)
      .eq('supplier_id', supplierId)
      .order('imported_at', { ascending: false })
      .limit(300),
  ])

  if (error) {
    return (
      <main className="p-8">
        <div className="rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2">
          {error.message}
        </div>
      </main>
    )
  }

  const cols = fields ?? []

  return (
    <main className="p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Items</h1>
          <div className="flex items-center gap-2">
            <Link href={`/suppliers/${supplierId}/map`} className="btn">Map fields</Link>
            <Link href="/suppliers" className="btn">Back</Link>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead className="thead">
              <tr>
                <th className="th">ID</th> {/* internal DB id */}
                {cols.map((c: any) => (
                  <th className="th" key={c.id}>{c.name}</th>
                ))}
                <th className="th">Imported</th>
              </tr>
            </thead>
            <tbody>
              {(items ?? []).map((row: any) => (
                <tr key={row.id} className="border-b last:border-b-0">
                  <td className="td">{row.id}</td>
                  {cols.map((c: any) => {
                    const v = row.fields?.[c.key]
                    return <td className="td" key={c.id}>{v == null ? '—' : String(v)}</td>
                  })}
                  <td className="td">{new Date(row.imported_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(!items || items.length === 0) && (
          <div className="text-muted">No items found for this supplier. Import a feed after mapping.</div>
        )}
      </div>
    </main>
  )
}
