import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getMyWorkspaces } from '@/lib/workspace'

export default async function Home() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md mx-auto text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Welcome to Supplier Feed Hub</h1>
          <p className="text-lg text-gray-600 mb-8">Please log in to continue.</p>
          <a 
            href="/login" 
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Sign In
          </a>
        </div>
      </div>
    )
  }

  // Get user's workspaces
  const workspaces = await getMyWorkspaces()

  // If no workspaces, redirect to workspaces page for onboarding
  if (workspaces.length === 0) {
    redirect('/workspaces')
  }

  // If user has workspaces, redirect to dashboard
  redirect('/dashboard')
}
