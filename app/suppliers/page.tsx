// app/suppliers/page.tsx
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'
import SupplierEditModal from '@/components/SupplierEditModal'
import Button from '@/components/ui/Button'
import ReRunButton from '@/components/ReRunButton'
import ConfirmSubmitButton from '@/components/ConfirmSubmitButton'

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
          <Link href="/login" className="text-blue-600">
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
      'id, name, is_draft, source_type, endpoint_url, source_path, schedule, created_at, uid_source_key'
    )
    .eq('workspace_id', wsId)
    .order('is_draft', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    return (
      <main className="p-8">
        <div className="max-5xl mx-auto">
          <div className="rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2">
            Error loading suppliers: {error.message}
          </div>
        </div>
      </main>
    )
  }

  // User timezone for formatting Last Import (from user_preferences)
  const { data: pref } = await supabase
    .from('user_preferences')
    .select('timezone')
    .eq('user_id', user.id)
    .maybeSingle()
  const userTz = pref?.timezone || 'UTC'
  const fmtTs = (d: string | Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: userTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(d as any)).replace(',', '')

  // 4) Recent ingestion status per supplier (latest finished first; pending nulls last)
  let lastStatus = new Map<string, any>()
  if (suppliers && suppliers.length > 0) {
    const { data: recentIngestions } = await supabase
      .from('feed_ingestions')
      .select('supplier_id, status, finished_at, started_at')
      .in(
        'supplier_id',
        suppliers.map((s: any) => s.id)
      )
      // Ensure pending (NULL finished_at) doesn't overshadow a completed row:
      .order('finished_at', { ascending: false, nullsFirst: false } as any)
      .order('started_at', { ascending: false })

    if (recentIngestions) {
      for (const row of recentIngestions) {
        if (!lastStatus.has(row.supplier_id)) {
          const status = (row.status || 'pending').toString().toLowerCase()
          const when = row.finished_at || row.started_at || null
          const ts = when ? fmtTs(when) : null
          lastStatus.set(
            row.supplier_id,
            (
              <div className="leading-tight">
                <div className="capitalize">{status}</div>
                <div className="font-mono text-xs text-gray-600">
                  {ts || '—'}
                </div>
              </div>
            )
          )
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

        {autoSelectedWorkspaceName && (
          <div className="rounded border bg-yellow-50 text-yellow-900 px-3 py-2">
            No active workspace was selected. Showing data for{' '}
            <strong>{autoSelectedWorkspaceName}</strong>. Use the workspace
            switcher to change it.
          </div>
        )}

        {/* Table */}
        <div className="rounded-2xl border p-6 bg-card">
          <h2 className="text-xl font-semibold mb-3">
            Suppliers in this workspace
          </h2>

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
                      <td className="td">
                        {s.name || '—'}
                        {s.is_draft ? (
                          <span className="ml-2 inline-block rounded bg-yellow-100 text-yellow-800 px-2 py-0.5 text-xs">
                            Draft
                          </span>
                        ) : null}
                      </td>
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
                          {s.is_draft ? (
                            <>
                              <Link
                                href={`/suppliers/new?supplier=${s.id}`}
                                className="btn"
                              >
                                Resume setup
                              </Link>

                              {/* Delete (draft) */}
                              <form
                                action={async (formData) => {
                                  'use server'
                                  const {
                                    deleteSupplierAction,
                                  } = await import(
                                    '../(dashboard)/actions/supplierActions'
                                  )
                                  return deleteSupplierAction(formData)
                                }}
                              >
                                <input
                                  type="hidden"
                                  name="supplier_id"
                                  value={s.id}
                                />
                                <ConfirmSubmitButton label="Delete" />
                              </form>
                            </>
                          ) : (
                            <>
                              {/* Re-run import */}
                              <ReRunButton supplierId={s.id} />

                              {/* Map fields */}
                              <Link
                                href={`/suppliers/${s.id}/map`}
                                className="btn"
                              >
                                Map fields
                              </Link>

                              {/* View items */}
                              <Link
                                href={`/suppliers/${s.id}/mapped`}
                                className="btn"
                              >
                                View mapped
                              </Link>
                              <Link
                                href={`/suppliers/${s.id}/raw`}
                                className="btn"
                              >
                                View raw
                              </Link>

                              {/* Edit basic fields */}
                              <SupplierEditModal supplier={s} />

                              {/* Delete */}
                              <form
                                action={async (formData) => {
                                  'use server'
                                  const {
                                    deleteSupplierAction,
                                  } = await import(
                                    '../(dashboard)/actions/supplierActions'
                                  )
                                  return deleteSupplierAction(formData)
                                }}
                              >
                                <input
                                  type="hidden"
                                  name="supplier_id"
                                  value={s.id}
                                />
                                <ConfirmSubmitButton label="Delete" />
                              </form>
                            </>
                          )}
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
