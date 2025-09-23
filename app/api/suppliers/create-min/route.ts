// app/api/suppliers/create-min/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

type Body = {
  source_type: 'url' | 'upload'
  endpoint_url?: string | null
  source_path?: string | null
  auth_username?: string | null
  auth_password?: string | null
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()

  // Auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // Body
  const body = (await req.json().catch(() => ({}))) as Body
  const source_type = body?.source_type
  if (source_type !== 'url' && source_type !== 'upload') {
    return NextResponse.json({ error: 'Invalid source_type' }, { status: 400 })
  }

  // Resolve active workspace
  const cookieStore = await cookies()
  const cookieWs = cookieStore.get('active_workspace_id')?.value ?? null
  let workspace_id: string | null = null

  if (cookieWs) {
    const { data: ws } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('workspace_id', cookieWs)
      .maybeSingle()
    if (ws?.workspace_id) workspace_id = ws.workspace_id
  }

  if (!workspace_id) {
    const { data: firstWs, error: wsErr } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (wsErr) return NextResponse.json({ error: wsErr.message }, { status: 400 })
    if (!firstWs) return NextResponse.json({ error: 'No workspace found for user' }, { status: 400 })
    workspace_id = firstWs.workspace_id
  }

  // Build a DRAFT name to satisfy NOT NULL (will be overwritten in Step 3)
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const base =
    source_type === 'url'
      ? (body.endpoint_url?.trim() || 'URL')
      : (body.source_path || 'Upload')
  let host = 'Draft'
  try {
    host = source_type === 'url' ? new URL(base).host || 'Draft' : 'Draft'
  } catch {}
  const draftName = `Draft (${host} ${hh}:${mm})`

  // Insert minimal supplier (name is required by your schema)
  const { data, error } = await supabase
    .from('suppliers')
    .insert({
      workspace_id,
      name: draftName,                         // 👈 ensures NOT NULL is satisfied
      source_type,
      endpoint_url: source_type === 'url' ? (body.endpoint_url?.trim() || null) : null,
      source_path: source_type === 'upload' ? (body.source_path || null) : null,
      auth_username: body.auth_username || null,
      auth_password: body.auth_password || null,
      // schedule, uid_source_key are set later in the wizard
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ id: data!.id })
}
