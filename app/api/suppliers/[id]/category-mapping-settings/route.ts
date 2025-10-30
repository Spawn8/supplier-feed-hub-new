import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: supplierId } = await params
    const body = await req.json()
    const { category_mapping_enabled, selected_category_field, categories_loaded } = body

    // Get the supplier to verify it belongs to the user's workspace
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('workspace_id')
      .eq('id', supplierId)
      .single()

    if (supplierError || !supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    // Verify user has access to this workspace
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('workspace_id', supplier.workspace_id)
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Save or update the category mapping settings
    const { data, error } = await supabase
      .from('supplier_category_mapping_settings')
      .upsert({
        supplier_id: supplierId,
        category_mapping_enabled: category_mapping_enabled,
        selected_category_field: selected_category_field,
        categories_loaded: categories_loaded,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'supplier_id'
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving category mapping settings:', error)
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      settings: data 
    })

  } catch (e: any) {
    console.error('Error in category mapping settings API:', e)
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 })
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: supplierId } = await params

    // Get the supplier to verify it belongs to the user's workspace
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select('workspace_id')
      .eq('id', supplierId)
      .single()

    if (supplierError || !supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    // Verify user has access to this workspace
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('workspace_id', supplier.workspace_id)
      .eq('user_id', user.id)
      .single()

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get the category mapping settings
    const { data, error } = await supabase
      .from('supplier_category_mapping_settings')
      .select('*')
      .eq('supplier_id', supplierId)
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error fetching category mapping settings:', error)
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
    }

    return NextResponse.json({ 
      settings: data || null 
    })

  } catch (e: any) {
    console.error('Error in category mapping settings API:', e)
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 })
  }
}
