import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'
import { updateSupplier } from '@/lib/suppliers'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { id: supplierId } = await params
    const body = await req.json()
    
    const { workspace_id, ...supplierData } = body
    if (!workspace_id) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    // Update supplier
    const result = await updateSupplier(supplierId, supplierData)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      supplier: result.supplier 
    })
  } catch (error: any) {
    console.error('Error updating supplier metadata:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}