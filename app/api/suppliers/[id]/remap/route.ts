import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'
import { getSupplier } from '@/lib/suppliers'

/**
 * Simplified remap route - no longer needed since we don't store products_raw
 * Field mappings are applied during ingestion, so just trigger a re-sync
 */
export async function POST(
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

    // Get supplier details
    const supplier = await getSupplier(supplierId)
    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    // Verify supplier belongs to current workspace
    if (supplier.workspace_id !== workspaceId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Since we don't store products_raw anymore, remapping requires a full re-sync
    return NextResponse.json({ 
      success: true, 
      message: 'Field mappings are applied during re-sync. Please trigger a re-sync to update products.',
      requiresSync: true
    })
  } catch (error: any) {
    console.error('Error in remap route:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}