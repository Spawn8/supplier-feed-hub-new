import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'

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

    // Test WooCommerce connection
    const auth = Buffer.from(`${consumer_key}:${consumer_secret}`).toString('base64')
    const testUrl = `${store_url}/wp-json/wc/v3/system_status`

    const response = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    })

    if (!response.ok) {
      if (response.status === 401) {
        return NextResponse.json({ 
          error: 'Invalid credentials. Please check your Consumer Key and Consumer Secret.' 
        }, { status: 400 })
      } else if (response.status === 404) {
        return NextResponse.json({ 
          error: 'WooCommerce API not found. Please ensure WooCommerce is installed and REST API is enabled.' 
        }, { status: 400 })
      } else {
        return NextResponse.json({ 
          error: `Connection failed with status ${response.status}` 
        }, { status: 400 })
      }
    }

    const data = await response.json()

    return NextResponse.json({ 
      success: true, 
      message: 'Connection successful',
      store_info: {
        name: data.settings?.store_name || 'Unknown',
        version: data.settings?.version || 'Unknown',
        currency: data.settings?.currency || 'Unknown'
      }
    })
  } catch (error: any) {
    console.error('Error testing WooCommerce connection:', error)
    
    if (error.name === 'AbortError') {
      return NextResponse.json({ 
        error: 'Connection timeout. Please check your store URL and try again.' 
      }, { status: 400 })
    }
    
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}