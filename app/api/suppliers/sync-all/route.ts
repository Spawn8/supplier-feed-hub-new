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

    // Get all active suppliers
    const { data: suppliers, error } = await supabase
      .from('suppliers')
      .select('id, name')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')

    if (error) {
      console.error('Error fetching suppliers:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (!suppliers || suppliers.length === 0) {
      return NextResponse.json({ 
        error: 'No active suppliers found' 
      }, { status: 400 })
    }

    // Trigger sync for each supplier
    const syncPromises = suppliers.map(async (supplier) => {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/suppliers/${supplier.id}/ingest`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to sync supplier')
        }

        return { supplier_id: supplier.id, success: true }
      } catch (error) {
        console.error(`Error syncing supplier ${supplier.id}:`, error)
        return { 
          supplier_id: supplier.id, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        }
      }
    })

    const results = await Promise.all(syncPromises)
    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    return NextResponse.json({ 
      success: true,
      total: suppliers.length,
      successful,
      failed,
      results
    })
  } catch (error: any) {
    console.error('Error syncing all suppliers:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}
