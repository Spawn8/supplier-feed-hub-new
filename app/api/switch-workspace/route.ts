import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { setCurrentWorkspaceId } from '@/lib/workspace'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const id = (body?.workspace_id || '').toString()
    if (!id) return NextResponse.json({ error: 'Missing workspace_id' }, { status: 400 })

    const supabase = await createSupabaseServerClient()
    const { data: auth } = await supabase.auth.getUser()
    const user = auth?.user
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    // Verify membership
    const { data: mem, error: memErr } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('workspace_id', id)
      .eq('user_id', user.id)
      .limit(1)

    if (memErr || !mem || mem.length === 0) {
      return NextResponse.json({ error: 'You do not have access to this workspace' }, { status: 403 })
    }

    await setCurrentWorkspaceId(id)
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
