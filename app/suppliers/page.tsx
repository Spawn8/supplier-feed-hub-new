// app/suppliers/page.tsx
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'
import SupplierFormModal from '@/components/SupplierFormModal'
import SupplierEditModal from '@/components/SupplierEditModal'
import { deleteSupplierAction } from '../(dashboard)/actions/supplierActions'

export default async function SuppliersPage() {
  // ✅ FIX: Await the async client
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>
          Please{' '}
          <Link className="text-blue-600 underline" href="/login">
            log in
          </Link>
          .
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
            <Link href="/workspaces" className="text-blue-600 underline">
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

  return (
    <main className="p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Suppliers</h1>
          <SupplierFormModal />
        </div>

        <div className="rounded-2xl border p-6 bg-white">
          <h2 className="text-xl font-semibold mb-3">Suppliers in this workspace</h2>

          {!suppliers || suppliers.length === 0 ? (
            <div className="text-gray-600">No suppliers yet. Click “Add Supplier”.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Source</th>
                    <th className="py-2 pr-3">Schedule</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers?.map((s: any) => (
                    <tr key={s.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-3">{s.name}</td>
                      <td className="py-2 pr-3">{s.source_type}</td>
                      <td className="py-2 pr-3">
                        {s.source_type === 'url' ? s.endpoint_url : s.source_path || '—'}
                      </td>
                      <td className="py-2 pr-3">{s.schedule || '—'}</td>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <SupplierEditModal supplier={s} />
                          <form action={deleteSupplierAction}>
                            <input type="hidden" name="supplier_id" value={s.id} />
                            <button
                              className="px-2 py-1 rounded border hover:bg-gray-50"
                              aria-label="Delete supplier"
                            >
                              Delete
                            </button>
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
