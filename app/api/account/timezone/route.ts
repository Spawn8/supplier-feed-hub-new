import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(()=>({}))
  const tz = (body?.timezone || '').toString()
  if (!tz) return NextResponse.json({ error: 'Missing timezone' }, { status: 400 })

  const { error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: user.id, timezone: tz, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
