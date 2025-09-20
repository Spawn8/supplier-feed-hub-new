import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getMyWorkspaces } from '@/lib/workspace'
import WorkspaceList from './WorkspaceList'
import WorkspaceFormModal from './WorkspaceFormModal'

export default async function WorkspacesPage() {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <main className="p-8">
        <p>Please log in to manage workspaces.</p>
      </main>
    )
  }

  const workspaces = await getMyWorkspaces()

  return (
    <main className="p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Workspaces</h1>
          <WorkspaceFormModal />
        </div>

        <div className="rounded-2xl border p-6">
          <h2 className="text-xl font-semibold mb-3">Your workspaces</h2>
          <WorkspaceList workspaces={workspaces} />
        </div>
      </div>
    </main>
  )
}
