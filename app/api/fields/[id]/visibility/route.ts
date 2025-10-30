import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: fieldId } = await params
    const { is_visible } = await req.json()

    if (typeof is_visible !== 'boolean') {
      return NextResponse.json({ 
        error: 'is_visible must be a boolean value' 
      }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()

    // Update the field's visibility
    const { data, error } = await supabase
      .from('custom_fields')
      .update({ 
        is_visible,
        updated_at: new Date().toISOString()
      })
      .eq('id', fieldId)
      .select()
      .single()

    if (error) {
      console.error('Error updating field visibility:', error)
      return NextResponse.json({ 
        error: `Database error: ${error.message}`,
        details: error
      }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      field: data 
    })
  } catch (error: any) {
    console.error('Error updating field visibility:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}
