import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await req.json().catch(()=> ({}))
  const name = (body.name || '').toString().trim()
  const schedule = (body.schedule || null)
  const uid_source_key = (body.uid_source_key || '').toString().trim()

  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  if (!uid_source_key) return NextResponse.json({ error: 'UID source key is required' }, { status: 400 })

  // Load supplier
  const { data: s, error: sErr } = await supabase
    .from('suppliers')
    .select('id, workspace_id, uid_source_key, is_draft')
    .eq('id', id)
    .single()

  if (sErr || !s) return NextResponse.json({ error: sErr?.message || 'Supplier not found' }, { status: 404 })

  // Enforce uid_source_key immutability (if already set and different, block)
  if (s.uid_source_key && s.uid_source_key !== uid_source_key) {
    return NextResponse.json({ error: 'UID source is already set and cannot be changed' }, { status: 409 })
  }

  // Save final meta + mark not draft
  {
    const { error } = await supabase
      .from('suppliers')
      .update({ name, schedule, uid_source_key, is_draft: false })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  // Trigger ingest (server-to-server)
  const origin = process.env.NEXT_PUBLIC_APP_ORIGIN || ''
  try {
    const res = await fetch(`${origin}/api/suppliers/${s.id}/ingest`, { method: 'POST', cache: 'no-store' })
    const payload = await res.json().catch(()=> ({}))
    if (!res.ok) {
      return NextResponse.json({ error: payload?.error || 'Ingest failed after finalize' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, result: payload })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to call ingest endpoint' }, { status: 500 })
  }
}
