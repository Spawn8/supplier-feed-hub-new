import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const workspaceId = await getCurrentWorkspaceId()
    if (!workspaceId) return NextResponse.json({ error: 'No workspace selected' }, { status: 400 })

    const { id } = await params

    const { error } = await supabase
      .from('category_mappings')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('Error deleting category mapping:', e)
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 })
  }
}

