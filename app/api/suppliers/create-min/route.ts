import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const wsId = await getCurrentWorkspaceId()
  if (!wsId) return NextResponse.json({ error: 'No workspace selected' }, { status: 400 })

  const body = await req.json().catch(()=> ({}))
  const source_type = body.source_type === 'upload' ? 'upload' : 'url'
  const endpoint_url = body.endpoint_url || null
  const source_path  = body.source_path || null
  const auth_username = body.auth_username || null
  const auth_password = body.auth_password || null

  if (source_type === 'url' && !endpoint_url) {
    return NextResponse.json({ error: 'endpoint_url is required' }, { status: 400 })
  }
  if (source_type === 'upload' && !source_path) {
    return NextResponse.json({ error: 'source_path is required' }, { status: 400 })
  }

  const { data, error } = await supabase.from('suppliers').insert({
    workspace_id: wsId,
    name: 'New supplier',
    source_type,
    endpoint_url,
    source_path,
    auth_username,
    auth_password,
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, id: data!.id })
}
