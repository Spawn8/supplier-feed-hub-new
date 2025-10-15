import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const workspaceId = await getCurrentWorkspaceId()
    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace selected' }, { status: 400 })
    }

    const { data: profiles, error } = await supabase
      .from('export_profiles')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching export profiles:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ profiles })
  } catch (error: any) {
    console.error('Error fetching export profiles:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}
