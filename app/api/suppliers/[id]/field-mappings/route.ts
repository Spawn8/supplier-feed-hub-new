import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = await createSupabaseServerClient()
  const wsId = await getCurrentWorkspaceId()
  if (!wsId) return NextResponse.json({ error: 'No workspace' }, { status: 400 })
  const { data, error } = await supabase
    .from('field_mappings')
    .select('source_key, field_key')
    .eq('workspace_id', wsId)
    .eq('supplier_id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ mappings: data || [] })
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = await createSupabaseServerClient()
  const wsId = await getCurrentWorkspaceId()
  if (!wsId) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

  const body = await req.json()
  const mappings = body?.mappings || {}

  // Clear existing
  await supabase
    .from('field_mappings')
    .delete()
    .eq('workspace_id', wsId)
    .eq('supplier_id', id)

  const rows = Object.entries(mappings)
    .filter(([src, dst]) => src && dst)
    .map(([src, dst]) => ({
      workspace_id: wsId,
      supplier_id: id,
      source_key: src,
      field_key: dst,
    }))

  if (rows.length > 0) {
    const { error } = await supabase.from('field_mappings').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ ok: true })
}
