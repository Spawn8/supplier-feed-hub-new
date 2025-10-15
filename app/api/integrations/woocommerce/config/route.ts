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

    // Get WooCommerce configuration
    const { data: config, error } = await supabase
      .from('integration_configs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('integration_type', 'woocommerce')
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching WooCommerce config:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ 
      config: config || {
        store_url: '',
        consumer_key: '',
        consumer_secret: '',
        is_connected: false
      }
    })
  } catch (error: any) {
    console.error('Error fetching WooCommerce config:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}

export async function POST(req: Request) {
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

    const body = await req.json()
    const { store_url, consumer_key, consumer_secret } = body

    if (!store_url || !consumer_key || !consumer_secret) {
      return NextResponse.json({ 
        error: 'Store URL, Consumer Key, and Consumer Secret are required' 
      }, { status: 400 })
    }

    // Save or update WooCommerce configuration
    const { data: config, error } = await supabase
      .from('integration_configs')
      .upsert({
        workspace_id: workspaceId,
        integration_type: 'woocommerce',
        config_data: {
          store_url,
          consumer_key,
          consumer_secret,
          is_connected: true
        }
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving WooCommerce config:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      config: config.config_data 
    })
  } catch (error: any) {
    console.error('Error saving WooCommerce config:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}
