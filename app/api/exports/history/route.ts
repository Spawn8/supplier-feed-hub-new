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

    const { data: history, error } = await supabase
      .from('export_history')
      .select(`
        id,
        export_profile_id,
        filename,
        file_size,
        item_count,
        generation_time_ms,
        download_url,
        expires_at,
        created_at,
        export_profiles (
          name
        )
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      console.error('Error fetching export history:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ history })
  } catch (error: any) {
    console.error('Error fetching export history:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}
