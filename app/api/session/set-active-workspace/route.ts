import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { setCurrentWorkspaceId } from '@/lib/workspace'

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await req.json()
    const { workspace_id } = body

    if (!workspace_id) {
      return NextResponse.json({ 
        error: 'Workspace ID is required' 
      }, { status: 400 })
    }

    // Verify user has access to this workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ 
        error: 'You do not have access to this workspace' 
      }, { status: 403 })
    }

    // Set active workspace in cookie
    await setCurrentWorkspaceId(workspace_id)

    return NextResponse.json({ 
      success: true, 
      workspace_id,
      role: membership.role
    })
  } catch (error: any) {
    console.error('Error setting active workspace:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}