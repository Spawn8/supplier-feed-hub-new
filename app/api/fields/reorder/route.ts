import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    const wsId = await getCurrentWorkspaceId()
    if (!wsId) return NextResponse.json({ error: 'No workspace selected' }, { status: 400 })

    const body = await req.json().catch(()=>({}))
    const ids: string[] = Array.isArray(body?.ids) ? body.ids : []
    if (!ids.length) return NextResponse.json({ error: 'No ids provided' }, { status: 400 })

    // Update sort_order sequentially based on incoming order
    let order = 1
    for (const id of ids) {
      const { error } = await supabase
        .from('custom_fields')
        .update({ sort_order: order })
        .eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      order++
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unexpected error' }, { status: 500 })
  }
}
