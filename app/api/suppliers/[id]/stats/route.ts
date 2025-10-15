import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: supplierId } = await params

    console.log(`Fetching stats for supplier ${supplierId} in workspace ${workspaceId}`)

    // Get supplier info with all sync data
    let supplier = null
    try {
      const { data: supplierData, error: supplierError } = await supabase
        .from('suppliers')
        .select(`
          id, name, status, error_message,
          last_sync_status, last_sync_started_at, last_sync_completed_at,
          last_sync_duration_ms, last_sync_items_total, last_sync_items_success, 
          last_sync_items_errors, last_sync_error_message,
          creation_started_at, creation_completed_at
        `)
        .eq('id', supplierId)
        .eq('workspace_id', workspaceId)
        .single()
      
      if (supplierError) {
        console.log('Error fetching supplier:', supplierError)
      } else {
        supplier = supplierData
        console.log('Supplier found:', supplier)
        console.log('Supplier timestamps:', {
          creation_started_at: supplier.creation_started_at,
          creation_completed_at: supplier.creation_completed_at,
          last_sync_started_at: supplier.last_sync_started_at,
          last_sync_completed_at: supplier.last_sync_completed_at,
          last_sync_status: supplier.last_sync_status
        })
      }
    } catch (err) {
      console.log('Error fetching supplier:', err)
    }

    // Get product counts
    let totalProducts = 0
    let mappedProducts = 0
    
    try {
      const { count: rawCount } = await supabase
        .from('products_raw')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('supplier_id', supplierId)
      totalProducts = rawCount || 0
    } catch (err) {
      console.log('No products_raw table or RLS issue:', err)
    }

    try {
      const { count: mappedCount } = await supabase
        .from('products_mapped')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('supplier_id', supplierId)
      mappedProducts = mappedCount || 0
    } catch (err) {
      console.log('No products_mapped table or RLS issue:', err)
    }

    // Determine status and timestamp from supplier data
    let actualStatus = 'never'
    let lastSyncAt = null

    if (supplier) {
      // Use the sync status from supplier table
      actualStatus = supplier.last_sync_status || 'never'
      
      // Use completed_at if available, otherwise started_at
      if (supplier.last_sync_completed_at) {
        lastSyncAt = supplier.last_sync_completed_at
      } else if (supplier.last_sync_started_at) {
        lastSyncAt = supplier.last_sync_started_at
      }
    }

    const stats = {
      last_sync_at: lastSyncAt,
      last_sync_status: actualStatus,
      last_sync_started_at: supplier?.last_sync_started_at,
      last_sync_completed_at: supplier?.last_sync_completed_at,
      last_sync_duration_ms: supplier?.last_sync_duration_ms,
      last_sync_items_total: supplier?.last_sync_items_total || 0,
      last_sync_items_success: supplier?.last_sync_items_success || 0,
      last_sync_items_errors: supplier?.last_sync_items_errors || 0,
      last_sync_error_message: supplier?.last_sync_error_message,
      creation_started_at: supplier?.creation_started_at,
      creation_completed_at: supplier?.creation_completed_at,
      total_products: totalProducts,
      mapped_products: mappedProducts
    }

    console.log('Returning stats:', stats)
    console.log('Stats timestamps:', {
      creation_completed_at: stats.creation_completed_at,
      last_sync_completed_at: stats.last_sync_completed_at,
      last_sync_status: stats.last_sync_status
    })

    return NextResponse.json({ stats })
  } catch (error: any) {
    console.error('Error fetching supplier stats:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}