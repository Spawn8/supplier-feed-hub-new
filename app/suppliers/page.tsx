import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'
import { deleteSupplierAction } from '../(dashboard)/actions/supplierActions'
import SupplierFormModal from './SupplierFormModal'

export default async function SuppliersPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return <main className="p-8">Please log in.</main>

  const wsId = await getCurrentWorkspaceId()
  if (!wsId) return <main className="p-8">Select or create a workspace first.</main>

  const { data: suppliers, error } = await supabase
    .from('suppliers')
    .select('id, name, source_type, endpoint_url, source_path, schedule, created_at')
    .eq('workspace_id', wsId)
    .order('created_at', { ascending: false })

  if (error) return <main className="p-8 text-red-600">Error: {error.message}</main>

  return (
    <main className="p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Suppliers</h1>
          <SupplierFormModal />
        </div>

        <div className="rounded-2xl border p-6">
          <h2 className="text-xl font-semibold mb-3">Suppliers in this workspace</h2>
          {(!suppliers || suppliers.length === 0) ? (
            <div className="text-gray-600">No suppliers yet.</div>
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
                  {suppliers.map((s) => (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="py-2 pr-3">{s.name}</td>
                      <td className="py-2 pr-3">{s.source_type}</td>
                      <td className="py-2 pr-3 break-all">
                        {s.source_type === 'url' ? s.endpoint_url : `storage://feeds/${s.source_path}`}
                      </td>
                      <td className="py-2 pr-3">{s.schedule || '—'}</td>
                      <td className="py-2">
                        <form action={deleteSupplierAction}>
                          <input type="hidden" name="supplier_id" value={s.id} />
                          <button className="px-3 py-1.5 rounded border text-red-600 hover:bg-red-50">Delete</button>
                        </form>
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
