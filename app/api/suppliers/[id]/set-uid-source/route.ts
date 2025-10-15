import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'
import { getSupplier } from '@/lib/suppliers'

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
    const body = await req.json()
    const { uid_source_key } = body

    if (!uid_source_key) {
      return NextResponse.json({ 
        error: 'UID source key is required' 
      }, { status: 400 })
    }

    // Get supplier details
    const supplier = await getSupplier(supplierId)
    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    // Verify supplier belongs to current workspace
    if (supplier.workspace_id !== workspaceId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Update supplier settings with UID source key
    const { error } = await supabase
      .from('suppliers')
      .update({
        settings: {
          ...supplier.settings,
          uid_source_key
        }
      })
      .eq('id', supplierId)

    if (error) {
      console.error('Error updating UID source key:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error setting UID source key:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}