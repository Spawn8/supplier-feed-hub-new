import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getMyWorkspaces, getCurrentWorkspaceId } from '@/lib/workspace'

export default async function Home() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold">Welcome to Supplier Feed Hub</h1>
        <p>Please log in to continue.</p>
      </div>
    )
  }

  const workspaces = await getMyWorkspaces()
  const wsId = await getCurrentWorkspaceId()

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-4">Dashboard</h1>

      {workspaces.length === 0 && (
        <div className="bg-yellow-50 border rounded p-6 max-w-md">
          <h2 className="text-lg font-semibold mb-2">No workspaces yet</h2>
          <p>Use the “+ New Workspace” button in the left sidebar.</p>
        </div>
      )}

      {wsId && (
        <div className="mt-6">
          <p className="text-gray-700">
            Active workspace ID: <span className="font-mono">{wsId}</span>
          </p>
        </div>
      )}

      <div className="mt-8 border rounded p-6">
        <h2 className="text-xl font-semibold mb-3">Next steps</h2>
        <ul className="list-disc ml-6 text-gray-700">
          <li>Suppliers: add a feed (URL or upload)</li>
          <li>Field mapping & category builder</li>
          <li>Dedup by EAN + rule engine</li>
          <li>Exports (CSV/XML/JSON)</li>
        </ul>
      </div>
    </div>
  )
}
