import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'
import FieldFormModal from '@/components/FieldFormModal'
import FieldDeleteButton from '@/components/FieldDeleteButton'

export default async function FieldsPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Please <Link href="/login" className="text-blue-600">log in</Link>.</p>
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
            Go to <Link href="/workspaces" className="text-blue-600">Workspaces</Link> to create or select one.
          </p>
        </div>
      </main>
    )
  }

  const { data: fields, error } = await supabase
    .from('custom_fields')
    .select('id, name, key, datatype, sort_order')
    .eq('workspace_id', wsId)
    .order('sort_order', { ascending: true })

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
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Fields</h1>
          <FieldFormModal />
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead className="thead">
              <tr>
                <th className="th">Name</th>
                <th className="th">Key</th>
                <th className="th">Type</th>
                <th className="th">Order</th>
                <th className="th">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(fields ?? []).map((f: any) => (
                <tr key={f.id} className="border-b last:border-b-0">
                  <td className="td">{f.name}</td>
                  <td className="td">{f.key}</td>
                  <td className="td">{f.datatype}</td>
                  <td className="td">{f.sort_order}</td>
                  <td className="td">
                    <FieldDeleteButton id={f.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(fields ?? []).length === 0 && (
          <div className="text-muted">No fields yet. Click “Add Field”.</div>
        )}
      </div>
    </main>
  )
}
