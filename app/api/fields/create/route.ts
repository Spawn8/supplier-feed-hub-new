import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'
import { createCustomField } from '@/lib/fields'

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await req.json()
    const { workspace_id, name, key, datatype, description, is_required, is_unique, use_for_category_mapping } = body

    if (!workspace_id) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    // Validate required fields
    if (!name || !key || !datatype) {
      return NextResponse.json({ 
        error: 'Name, key, and datatype are required' 
      }, { status: 400 })
    }

    // Validate datatype
    const validDatatypes = ['text', 'number', 'bool', 'date', 'json']
    if (!validDatatypes.includes(datatype)) {
      return NextResponse.json({ 
        error: 'Invalid datatype. Must be one of: ' + validDatatypes.join(', ') 
      }, { status: 400 })
    }

    // Get the next sort order by finding the highest sort_order for this workspace
    const { data: maxOrderData } = await supabase
      .from('custom_fields')
      .select('sort_order')
      .eq('workspace_id', workspace_id)
      .order('sort_order', { ascending: false })
      .limit(1)
    
    const nextSortOrder = maxOrderData && maxOrderData.length > 0 
      ? (maxOrderData[0].sort_order || 0) + 1 
      : 1

    // Create custom field in database
    console.log('Creating custom field in database...')
    
    const { data: field, error } = await supabase
      .from('custom_fields')
      .insert({
        workspace_id: workspace_id,
        name,
        key,
        datatype,
        description,
        is_required: is_required || false,
        is_unique: is_unique || false,
        use_for_category_mapping: use_for_category_mapping || false,
        sort_order: nextSortOrder
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating custom field:', error)
      return NextResponse.json({ 
        error: `Database error: ${error.message}`,
        details: error
      }, { status: 400 })
    }

    console.log('✅ Custom field created successfully in database:', field.id)
    console.log('Field details:', JSON.stringify(field, null, 2))

    return NextResponse.json({ 
      success: true, 
      field 
    })
  } catch (error: any) {
    console.error('Error creating custom field:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}