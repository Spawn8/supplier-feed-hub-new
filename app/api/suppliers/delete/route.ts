import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { deleteSupplier } from '@/lib/suppliers'

export async function DELETE(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const supplierId = searchParams.get('id')

    if (!supplierId) {
      return NextResponse.json({ 
        error: 'Supplier ID is required' 
      }, { status: 400 })
    }

    // Fetch supplier to infer workspace and authorize user
    const { data: supplier, error: supplierFetchError } = await supabase
      .from('suppliers')
      .select('id, workspace_id')
      .eq('id', supplierId)
      .single()

    if (supplierFetchError || !supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    // Verify user is a member of the supplier's workspace
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', supplier.workspace_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete supplier
    const result = await deleteSupplier(supplierId)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting supplier:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}