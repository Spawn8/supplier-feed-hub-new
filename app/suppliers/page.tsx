// app/suppliers/page.tsx
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'
import SupplierFormModal from '@/components/SupplierFormModal'
import SupplierEditModal from '@/components/SupplierEditModal'
import Button from '@/components/ui/Button'
import ImportNowButton from '@/components/ImportNowButton'
import { deleteSupplierAction } from '../(dashboard)/actions/supplierActions'

export default async function SuppliersPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>
          Please <Link className="text-blue-600" href="/login">log in</Link>.
        </p>
      </main>
    )
  }

  const wsId = await getCurrentWorkspaceId()
  if (!wsId) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-semibold">No workspace selected</h1>
          <p className="text-gray-600">
            Go to{' '}
            <Link href="/workspaces" className="text-blue-600">
              Workspaces
            </Link>{' '}
            to create or select one.
          </p>
        </div>
      </main>
    )
  }

  const { data: suppliers, error } = await supabase
    .from('suppliers')
    .select(
      'id, name, source_type, endpoint_url, source_path, schedule, auth_username, auth_password, created_at'
    )
    .eq('workspace_id', wsId)
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <main className="p-8">
        <div className="max-w-5xl mx-auto">
          <div className="rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2">
            Error loading suppliers: {error.message}
          </div>
        </div>
      </main>
    )
  }

  // Fetch recent ingestion status per supplier (just the latest)
  let lastStatus = new Map<string, string>()
  if (suppliers && suppliers.length > 0) {
    const { data: recentIngestions } = await supabase
      .from('feed_ingestions')
      .select('supplier_id, status, finished_at')
      .in(
        'supplier_id',
        suppliers.map((s: any) => s.id)
      )
      .order('finished_at', { ascending: false })

    if (recentIngestions) {
      for (const row of recentIngestions) {
        if (!lastStatus.has(row.supplier_id)) {
          lastStatus.set(row.supplier_id, row.status || 'pending')
        }
      }
    }
  }

  return (
    <main className="p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Suppliers</h1>
          <SupplierFormModal />
        </div>

        {/* Table */}
        <div className="rounded-2xl border p-6 bg-card">
          <h2 className="text-xl font-semibold mb-3">Suppliers in this workspace</h2>

          {!suppliers || suppliers.length === 0 ? (
            <div className="text-gray-600">No suppliers yet. Click “Add Supplier”.</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead className="thead">
                  <tr>
                    <th className="th">Name</th>
                    <th className="th">Type</th>
                    <th className="th">Source</th>
                    <th className="th">Schedule</th>
                    <th className="th">Last Import</th>
                    <th className="th">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers?.map((s: any) => (
                    <tr key={s.id} className="border-b last:border-b-0">
                      <td className="td">{s.name}</td>
                      <td className="td">{s.source_type}</td>
                      <td className="td">
                        {s.source_type === 'url' ? s.endpoint_url : s.source_path || '—'}
                      </td>
                      <td className="td">{s.schedule || '—'}</td>
                      <td className="td">{lastStatus.get(s.id) ?? '—'}</td>
                      <td className="td">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Import without leaving the page */}
                          <ImportNowButton supplierId={s.id} />

                          {/* View raw imported items for this supplier */}
                          <Link href={`/suppliers/${s.id}/raw`} className="btn">
                            View items
                          </Link>

                          {/* Edit supplier */}
                          <SupplierEditModal supplier={s} />

                          {/* Delete supplier (server action) */}
                          <form action={deleteSupplierAction}>
                            <input type="hidden" name="supplier_id" value={s.id} />
                            <Button variant="danger" aria-label="Delete supplier" className="cursor-pointer">
                              Delete
                            </Button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
