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

    // Get latest sync job
    const { data: syncJob, error } = await supabase
      .from('sync_jobs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('integration_type', 'woocommerce')
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching sync status:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const status = {
      is_running: syncJob?.status === 'running',
      last_sync_at: syncJob?.completed_at || syncJob?.started_at,
      products_synced: syncJob?.products_synced || 0,
      products_created: syncJob?.products_created || 0,
      products_updated: syncJob?.products_updated || 0,
      products_skipped: syncJob?.products_skipped || 0,
      errors: syncJob?.errors || []
    }

    return NextResponse.json({ status })
  } catch (error: any) {
    console.error('Error fetching sync status:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}
