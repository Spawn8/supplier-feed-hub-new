import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'
import { deleteCustomField } from '@/lib/fields'

export async function DELETE(
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

    const workspaceId = await getCurrentWorkspaceId()
    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace selected' }, { status: 400 })
    }

    // Verify field belongs to workspace
    const { data: field } = await supabase
      .from('custom_fields')
      .select('id, workspace_id')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (!field) {
      return NextResponse.json({ error: 'Field not found' }, { status: 404 })
    }

    // Delete custom field
    const result = await deleteCustomField(id)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting custom field:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}