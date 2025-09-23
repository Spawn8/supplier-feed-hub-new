import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const wsId = await getCurrentWorkspaceId()
    if (!wsId) return NextResponse.json({ error: 'No active workspace' }, { status: 400 })

    const body = await req.json().catch(()=>({}))
    const id = (body?.supplier_id || '').toString()
    if (!id) return NextResponse.json({ error: 'Missing supplier id' }, { status: 400 })

    const { data: supplier, error: getErr } = await supabase
      .from('suppliers')
      .select('id, source_type, source_path')
      .eq('id', id)
      .eq('workspace_id', wsId)
      .single()
    if (getErr) return NextResponse.json({ error: getErr.message }, { status: 400 })

    const { error: delErr } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id)
      .eq('workspace_id', wsId)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 })

    if (supplier?.source_type === 'upload' && supplier?.source_path) {
      await supabase.storage.from('feeds').remove([supplier.source_path])
    }

    revalidatePath('/suppliers')
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
