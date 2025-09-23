import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const wsId = await getCurrentWorkspaceId()
  if (!wsId) return NextResponse.json({ fields: [] })
  const { data, error } = await supabase
    .from('custom_fields')
    .select('id, key, name, datatype, sort_order')
    .eq('workspace_id', wsId)
    .order('sort_order', { ascending: true })
  if (error) return NextResponse.json({ fields: [] })
  return NextResponse.json({ fields: data || [] })
}
