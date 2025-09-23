// app/suppliers/page.tsx
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'
import SupplierEditModal from '@/components/SupplierEditModal'
import Button from '@/components/ui/Button'
import ReRunButton from '@/components/ReRunButton'

export default async function SuppliersPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>
          Please{' '}
          <Link className="text-blue-600" href="/login">
            log in
          </Link>
          .
        </p>
      </main>
    )
  }

  // 1) Try to get active workspace via your helper
  let wsId = await getCurrentWorkspaceId()
  let autoSelectedWorkspaceName: string | null = null

  // 2) If none, auto-pick the first workspace the user belongs to as a graceful fallback
  if (!wsId) {
    const { data: firstWs, error: wsErr } = await supabase
      .from('workspace_members')
      .select('workspace_id, workspaces ( name )')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (wsErr) {
      return (
        <main className="p-8">
          <div className="max-w-5xl mx-auto">
            <div className="rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2">
              Error resolving workspace: {wsErr.message}
            </div>
          </div>
        </main>
      )
    }

    if (!firstWs?.workspace_id) {
      return (
        <main className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-3">
            <h1 className="text-2xl font-semibold">No workspace found</h1>
            <p className="text-gray-600">
              Go to{' '}
              <Link href="/workspaces" className="text-blue-600">
                Workspaces
              </Link>{' '}
              to create one.
            </p>
          </div>
        </main>
      )
    }

    wsId = firstWs.workspace_id
    autoSelectedWorkspaceName = firstWs.workspaces?.name ?? null
  }

  // 3) Load suppliers for resolved workspace
  const { data: suppliers, error } = await supabase
    .from('suppliers')
    .select(
      'id, name, source_type, endpoint_url, source_path, schedule, created_at, uid_source_key'
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

  // 4) Recent ingestion status per supplier (first/latest finished row wins)
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
          <Link href="/suppliers/new" className="btn">
            + Add Supplier
          </Link>
        </div>

        {/* Notice when we auto-selected a workspace */}
        {autoSelectedWorkspaceName && (
          <div className="rounded border bg-yellow-50 text-yellow-900 px-3 py-2">
            No active workspace was selected. Showing data for{' '}
            <strong>{autoSelectedWorkspaceName}</strong>.
            Use the workspace switcher to change it.
          </div>
        )}

        {/* Table */}
        <div className="rounded-2xl border p-6 bg-card">
          <h2 className="text-xl font-semibold mb-3">Suppliers in this workspace</h2>

          {!suppliers || suppliers.length === 0 ? (
            <div className="text-gray-600">
              No suppliers yet. Click “Add Supplier”.
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead className="thead">
                  <tr>
                    <th className="th">Name</th>
                    <th className="th">Type</th>
                    <th className="th">Source</th>
                    <th className="th">Schedule</th>
                    <th className="th">UID</th>
                    <th className="th">Last Import</th>
                    <th className="th">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers?.map((s: any) => (
                    <tr key={s.id} className="border-b last:border-b-0">
                      <td className="td">{s.name || '—'}</td>
                      <td className="td">{s.source_type}</td>
                      <td className="td">
                        {s.source_type === 'url'
                          ? s.endpoint_url
                          : s.source_path || '—'}
                      </td>
                      <td className="td">{s.schedule || '—'}</td>
                      <td className="td">{s.uid_source_key || '—'}</td>
                      <td className="td">{lastStatus.get(s.id) ?? '—'}</td>
                      <td className="td">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Re-run import */}
                          <ReRunButton supplierId={s.id} />

                          {/* Map fields */}
                          <Link href={`/suppliers/${s.id}/map`} className="btn">
                            Map fields
                          </Link>

                          {/* View items */}
                          <Link href={`/suppliers/${s.id}/mapped`} className="btn">
                            View mapped
                          </Link>
                          <Link href={`/suppliers/${s.id}/raw`} className="btn">
                            View raw
                          </Link>

                          {/* Edit basic fields */}
                          <SupplierEditModal supplier={s} />

                          {/* Delete */}
                          {/* Keep your server action path unchanged */}
                          <form action={async (formData) => {
                            'use server'
                            const { deleteSupplierAction } = await import('../(dashboard)/actions/supplierActions')
                            return deleteSupplierAction(formData)
                          }}>
                            <input type="hidden" name="supplier_id" value={s.id} />
                            <Button
                              variant="danger"
                              aria-label="Delete supplier"
                              className="cursor-pointer"
                            >
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
