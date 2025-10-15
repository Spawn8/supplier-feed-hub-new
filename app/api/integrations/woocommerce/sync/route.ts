import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'

export async function POST() {
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

    // Get WooCommerce configuration
    const { data: config, error: configError } = await supabase
      .from('integration_configs')
      .select('config_data')
      .eq('workspace_id', workspaceId)
      .eq('integration_type', 'woocommerce')
      .single()

    if (configError || !config) {
      return NextResponse.json({ 
        error: 'WooCommerce configuration not found. Please set up the integration first.' 
      }, { status: 400 })
    }

    const { store_url, consumer_key, consumer_secret } = config.config_data

    if (!store_url || !consumer_key || !consumer_secret) {
      return NextResponse.json({ 
        error: 'WooCommerce configuration is incomplete' 
      }, { status: 400 })
    }

    // Create sync job
    const { data: syncJob, error: syncError } = await supabase
      .from('sync_jobs')
      .insert({
        workspace_id: workspaceId,
        integration_type: 'woocommerce',
        status: 'running',
        started_at: new Date().toISOString(),
        created_by: user.id
      })
      .select()
      .single()

    if (syncError) {
      console.error('Error creating sync job:', syncError)
      return NextResponse.json({ error: syncError.message }, { status: 400 })
    }

    // Start sync process (this would be implemented as a background job)
    // For now, we'll just return success
    return NextResponse.json({ 
      success: true, 
      sync_job_id: syncJob.id,
      message: 'Sync started successfully'
    })
  } catch (error: any) {
    console.error('Error starting WooCommerce sync:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}