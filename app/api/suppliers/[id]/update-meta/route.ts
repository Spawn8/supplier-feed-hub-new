import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(()=> ({}))
  const name = (body.name || '').toString().trim()
  const schedule = (body.schedule || null)

  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const { error } = await supabase
    .from('suppliers')
    .update({ name, schedule })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
