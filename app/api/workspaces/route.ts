import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function PUT(req: Request) {
  const { id, name } = await req.json()
  if (!id || !name) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('workspaces').update({ name }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: Request) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('workspaces').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
