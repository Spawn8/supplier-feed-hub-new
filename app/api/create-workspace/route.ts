import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function POST(req: Request) {
  const fd = await req.formData()
  const name = fd.get('name')?.toString().trim()
  if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // 1. Create workspace
  const { data: ws, error } = await supabase
    .from('workspaces')
    .insert({ name, created_by: user.id })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // 2. Add user as owner in workspace_members
  await supabase.from('workspace_members').insert({
    workspace_id: ws.id,
    user_id: user.id,
    role: 'owner',
  })

  return NextResponse.json({ ok: true })
}
