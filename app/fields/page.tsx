import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'
import FieldFormModal from '@/components/FieldFormModal'
import FieldsSortableTable from '@/components/FieldsSortableTable'

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

  return (
    <main className="p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Fields</h1>
          <FieldFormModal />
        </div>

        {/* Draggable, orderable fields table */}
        <FieldsSortableTable />
      </div>
    </main>
  )
}
