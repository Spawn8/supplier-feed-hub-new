import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient()
  const wsId = await getCurrentWorkspaceId()
  if (!wsId) return NextResponse.json({ error: 'No workspace' }, { status: 400 })
  const { data, error } = await supabase
    .from('field_mappings')
    .select('source_key, field_key')
    .eq('workspace_id', wsId)
    .eq('supplier_id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ mappings: data || [] })
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient()
  const wsId = await getCurrentWorkspaceId()
  if (!wsId) return NextResponse.json({ error: 'No workspace' }, { status: 400 })
  const body = await req.json().catch(()=> ({}))
  const mappings = (body?.mappings || {}) as Record<string,string>

  // Upsert by deleting missing sources and inserting/overwriting provided ones
  // Simpler approach: delete all then insert current selection
  await supabase
    .from('field_mappings')
    .delete()
    .eq('workspace_id', wsId)
    .eq('supplier_id', params.id)

  const rows = Object.entries(mappings)
    .filter(([src, dst]) => src && dst)
    .map(([src, dst]) => ({
      workspace_id: wsId,
      supplier_id: params.id,
      source_key: src,
      field_key: dst,
    }))

  if (rows.length) {
    const { error } = await supabase.from('field_mappings').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
