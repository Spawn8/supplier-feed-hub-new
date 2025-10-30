import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'
import { updateCustomField } from '@/lib/fields'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get workspace_id from the request body
    const body = await req.json()
    const { workspace_id, name, key, datatype, description, is_required, is_unique, use_for_category_mapping } = body

    if (!workspace_id) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    // Validate datatype if provided
    if (datatype) {
      const validDatatypes = ['text', 'number', 'bool', 'date', 'json']
      if (!validDatatypes.includes(datatype)) {
        return NextResponse.json({ 
          error: 'Invalid datatype. Must be one of: ' + validDatatypes.join(', ') 
        }, { status: 400 })
      }
    }

    // Update custom field
    const result = await updateCustomField(id, {
      name,
      key,
      datatype,
      description,
      is_required,
      is_unique,
      use_for_category_mapping
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      field: result.field 
    })
  } catch (error: any) {
    console.error('Error updating custom field:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}