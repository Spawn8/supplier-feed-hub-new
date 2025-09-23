import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function POST(req: Request, { params }: { params: { id: string } }) {
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
    .eq('id', params.id)
    .single()

  if (sErr || !s) return NextResponse.json({ error: sErr?.message || 'Supplier not found' }, { status: 404 })

  // Enforce uid_source_key immutability (if already set and different)
  if (s.uid_source_key && s.uid_source_key !== uid_source_key) {
    return NextResponse.json({ error: 'UID source is already set and cannot be changed' }, { status: 409 })
  }

  // Finalize supplier: set meta + uid + publish (is_draft=false)
  const { error: upErr } = await supabase
    .from('suppliers')
    .update({ name, schedule, uid_source_key, is_draft: false })
    .eq('id', s.id)

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 })

  // Trigger ingest via existing endpoint to reuse logic
  // We call the same route you already use: /api/suppliers/[id]/ingest
  const origin = process.env.NEXT_PUBLIC_APP_ORIGIN || '' // set in env for SSR calls, e.g. http://localhost:3000
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
