import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const uid_source_key = (body?.uid_source_key || '').toString().trim()
  if (!uid_source_key) return NextResponse.json({ error: 'uid_source_key is required' }, { status: 400 })

  // Read current supplier to know if already locked
  const { data: s, error: sErr } = await supabase
    .from('suppliers')
    .select('id, uid_source_key')
    .eq('id', params.id)
    .single()
  if (sErr || !s) return NextResponse.json({ error: sErr?.message || 'Supplier not found' }, { status: 404 })
  if (s.uid_source_key && s.uid_source_key !== uid_source_key) {
    return NextResponse.json({ error: 'UID source is already set and cannot be changed' }, { status: 409 })
  }

  const { error } = await supabase
    .from('suppliers')
    .update({ uid_source_key })
    .eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true, uid_source_key })
}
