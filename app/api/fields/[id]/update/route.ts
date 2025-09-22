import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(()=> ({}))
  const updates: any = {}
  for (const k of ['name','key','type','position','required']) {
    if (k in body) updates[k] = body[k]
  }
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'No updates' }, { status: 400 })

  const { error } = await supabase.from('custom_fields').update(updates).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
