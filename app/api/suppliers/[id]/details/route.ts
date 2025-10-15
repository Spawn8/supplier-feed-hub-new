import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const workspaceId = await getCurrentWorkspaceId()
    if (!workspaceId) return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })

    const { id } = await params

    const { data: supplier, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (error || !supplier) {
      return NextResponse.json({ error: error?.message || 'Supplier not found' }, { status: 404 })
    }

    return NextResponse.json({ supplier })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 })
  }
}