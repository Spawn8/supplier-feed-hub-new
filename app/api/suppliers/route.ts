import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'

export async function GET(req: Request) {
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

    // Get suppliers from database
    const { data: suppliers, error: suppliersError } = await supabase
      .from('suppliers')
      .select('*')
      .eq('workspace_id', workspaceId)

    if (suppliersError) {
      console.error('Error fetching suppliers:', suppliersError)
      return NextResponse.json({ 
        error: `Failed to fetch suppliers: ${suppliersError.message}` 
      }, { status: 500 })
    }

    console.log(`✅ Found ${suppliers?.length || 0} suppliers in database for workspace ${workspaceId}`)
    return NextResponse.json({ suppliers: suppliers || [] })
  } catch (error: any) {
    console.error('Error fetching suppliers:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}

// Note: Using centralized memory store from lib/memoryStore.ts
