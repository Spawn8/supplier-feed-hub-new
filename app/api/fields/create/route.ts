import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const wsId = await getCurrentWorkspaceId()
    if (!wsId) return NextResponse.json({ error: 'No workspace selected' }, { status: 400 })

    const body = await req.json().catch(()=> ({}))
    const name = String(body?.name || '').trim()
    const key = String(body?.key || '').trim()
    const datatype = (body?.datatype || 'text').toString()
    const sort_order = Number(body?.sort_order || 0)

    if (!name || !key) {
      return NextResponse.json({ error: 'Name and key are required' }, { status: 400 })
    }

    const { error } = await supabase.from('custom_fields').insert({
      workspace_id: wsId,
      name, key, datatype, sort_order
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
