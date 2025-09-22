import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { setCurrentWorkspaceId } from '@/lib/workspace'

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const name = (formData.get('name') || '').toString().trim()
    if (!name) {
      return NextResponse.json({ error: 'Workspace name is required' }, { status: 400 })
    }

    const supabase = await createSupabaseServerClient()
    const { data: auth } = await supabase.auth.getUser()
    const user = auth?.user
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    // 1) Create workspace
    const { data: ws, error: wErr } = await supabase
      .from('workspaces')
      .insert({ name, created_by: user.id })
      .select('id')
      .single()

    if (wErr || !ws) {
      return NextResponse.json({ error: wErr?.message || 'Failed to create workspace' }, { status: 400 })
    }

    // 2) Add membership (owner)
    const { error: mErr } = await supabase
      .from('workspace_members')
      .insert({ workspace_id: ws.id, user_id: user.id, role: 'owner' })

    if (mErr) {
      return NextResponse.json({ error: mErr.message }, { status: 400 })
    }

    // 3) Set active workspace cookie
    await setCurrentWorkspaceId(ws.id)

    return NextResponse.json({ id: ws.id }, { status: 200 })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
