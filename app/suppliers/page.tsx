// app/suppliers/page.tsx
export const dynamic = 'force-dynamic'
export const revalidate = 0

import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'
import SupplierEditModal from '@/components/SupplierEditModal'
import ReRunButton from '@/components/ReRunButton'
import ConfirmSubmitButton from '@/components/ConfirmSubmitButton'
import LastImportCell from '@/components/LastImportCell'

// Robust date parsing for Postgres strings like "YYYY-MM-DD hh:mm:ss.sss+00"
function toDateLike(v: unknown): Date | null {
  if (!v && v !== 0) return null
  if (v instanceof Date) return v
  if (typeof v === 'number') return new Date(v)
  const s = String(v)
  const normalized = s.includes('T') ? s : s.replace(' ', 'T')
  const ms = Date.parse(normalized)
  if (!Number.isNaN(ms)) return new Date(ms)
  const ms2 = Date.parse(s)
  return Number.isNaN(ms2) ? null : new Date(ms2)
}

export default async function SuppliersPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>
          Please <Link href="/login" className="text-blue-600">log in</Link>.
        </p>
      </main>
    )
  }

  // Resolve workspace (fallback to first membership)
  let wsId = await getCurrentWorkspaceId()
  let autoSelectedWorkspaceName: string | null = null

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
              Go to <Link href="/workspaces" className="text-blue-600">Workspaces</Link> to create one.
            </p>
          </div>
        </main>
      )
    }

    wsId = firstWs.workspace_id
    autoSelectedWorkspaceName = firstWs.workspaces?.name ?? null
  }

  // Load suppliers
  const { data: suppliers, error } = await supabase
    .from('suppliers')
    .select('id, name, is_draft, source_type, endpoint_url, source_path, schedule, created_at, uid_source_key')
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

  // User timezone + formatter
  const { data: pref } = await supabase
    .from('user_preferences')
    .select('timezone')
    .eq('user_id', user.id)
    .maybeSingle()
  const userTz = pref?.timezone || 'UTC'
  const fmtTs = (d: unknown) => {
    const dt = toDateLike(d)
    if (!dt) return '—'
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: userTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(dt).replace(',', '')
  }

  // Latest ingestion rows (newest finished and newest pending)
  type IngRow = {
    supplier_id: string
    status: string | null
    finished_at: string | null
    started_at: string | null
  }

  const latestFinished = new Map<string, IngRow>() // newest with finished_at
  const latestPending = new Map<string, IngRow>()   // newest without finished_at
  if (suppliers && suppliers.length > 0) {
    const { data: ingRows } = await supabase
      .from('feed_ingestions')
      .select('supplier_id, status, finished_at, started_at')
      .in('supplier_id', suppliers.map((s: any) => s.id))
      .order('finished_at', { ascending: false, nullsFirst: false } as any)
      .order('started_at', { ascending: false })

    if (ingRows) {
      for (const row of ingRows as IngRow[]) {
        if (row.finished_at) {
          if (!latestFinished.has(row.supplier_id)) latestFinished.set(row.supplier_id, row)
        } else {
          if (!latestPending.has(row.supplier_id)) latestPending.set(row.supplier_id, row)
        }
      }
    }
  }

  // Latest mapped timestamp per supplier (used only as a completion signal)
  const lastMapped = new Map<string, string>()
  if (suppliers && suppliers.length > 0) {
    const { data: mappedRows } = await supabase
      .from('products_mapped')
      .select('supplier_id, imported_at')
      .eq('workspace_id', wsId)
      .in('supplier_id', suppliers.map((s: any) => s.id))
      .order('imported_at', { ascending: false })

    if (mappedRows) {
      for (const row of mappedRows as any[]) {
        if (!lastMapped.has(row.supplier_id) && row.imported_at) {
          lastMapped.set(row.supplier_id, String(row.imported_at))
        }
      }
    }
  }

  // Build initial status/time for the client cell.
  // IMPORTANT: We DO NOT emit "running" from the server.
  // If any completion exists → Completed/Failed; else if there's a start only → Pending; else "—".
  const lastDisplay = new Map<
    string,
    { status: 'completed' | 'failed' | 'pending' | '—'; timeStr: string }
  >()

  const computeDisplay = (supplierId: string) => {
    const fin = latestFinished.get(supplierId)
    const pen = latestPending.get(supplierId)
    const mappedAt = lastMapped.get(supplierId)

    const finMs = fin?.finished_at ? toDateLike(fin.finished_at)?.getTime() : null
    const mapMs = mappedAt ? toDateLike(mappedAt)?.getTime() : null
    const penMs = pen?.started_at ? toDateLike(pen.started_at)?.getTime() : null

    // freshest completion time
    const bestCompleteMs =
      finMs !== null && mapMs !== null ? Math.max(finMs, mapMs) : (finMs ?? mapMs)

    if (bestCompleteMs !== null) {
      const newestIsFinished = finMs !== null && (mapMs === null || finMs >= mapMs)
      const status = newestIsFinished
        ? ((fin?.status || '').toLowerCase() === 'failed' ? 'failed' : 'completed')
        : 'completed'
      return { status, timeStr: fmtTs(bestCompleteMs) }
    }

    if (penMs !== null) {
      return { status: 'pending' as const, timeStr: fmtTs(penMs) }
    }

    return { status: '—' as const, timeStr: '—' }
  }

  if (suppliers) {
    for (const s of suppliers as any[]) {
      lastDisplay.set(s.id, computeDisplay(s.id))
    }
  }

  return (
    <main className="p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Suppliers</h1>
          <Link href="/suppliers/new" className="btn">+ Add Supplier</Link>
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
                    <th className="th">UID</th>
                    <th className="th">Last Import</th>
                    <th className="th">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers?.map((s: any) => {
                    const disp = lastDisplay.get(s.id) || { status: '—' as const, timeStr: '—' }
                    return (
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
                          {s.source_type === 'url' ? s.endpoint_url : s.source_path || '—'}
                        </td>
                        <td className="td">{s.schedule || '—'}</td>
                        <td className="td">{s.uid_source_key || '—'}</td>
                        <td className="td">
                          <LastImportCell
                            supplierId={s.id}
                            initialStatus={disp.status}
                            initialTime={disp.timeStr}
                          />
                        </td>
                        <td className="td">
                          <div className="flex flex-wrap items-center gap-2">
                            {s.is_draft ? (
                              <>
                                <Link href={`/suppliers/new?supplier=${s.id}`} className="btn">
                                  Resume setup
                                </Link>

                                {/* Delete (draft) */}
                                <form
                                  action={async (formData) => {
                                    'use server'
                                    const { deleteSupplierAction } = await import('../(dashboard)/actions/supplierActions')
                                    return deleteSupplierAction(formData)
                                  }}
                                >
                                  <input type="hidden" name="supplier_id" value={s.id} />
                                  <ConfirmSubmitButton label="Delete" />
                                </form>
                              </>
                            ) : (
                              <>
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

                                {/* Settings */}
                                <SupplierEditModal supplier={s} />

                                {/* Delete */}
                                <form
                                  action={async (formData) => {
                                    'use server'
                                    const { deleteSupplierAction } = await import('../(dashboard)/actions/supplierActions')
                                    return deleteSupplierAction(formData)
                                  }}
                                >
                                  <input type="hidden" name="supplier_id" value={s.id} />
                                  <ConfirmSubmitButton label="Delete" />
                                </form>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
