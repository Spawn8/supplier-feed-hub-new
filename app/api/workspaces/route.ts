import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

// In-memory storage for workspaces (temporary solution)
const workspaceStore = new Map<string, any>()

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get workspaces from database
    const { data: workspaces, error } = await supabase
      .from('workspaces')
      .select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching workspaces:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Format workspaces with owner role
    const formattedWorkspaces = workspaces?.map((workspace: any) => ({
      ...workspace,
      user_role: 'owner'
    })) || []

    return NextResponse.json({ workspaces: formattedWorkspaces })
  } catch (error: any) {
    console.error('Error fetching workspaces:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}

// Export the workspace store for use in create-workspace
export { workspaceStore }