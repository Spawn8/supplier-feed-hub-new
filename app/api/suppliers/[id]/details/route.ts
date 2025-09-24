import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = await createSupabaseServerClient()

  const { data: s, error } = await supabase
    .from('suppliers')
    .select('id, name, schedule, uid_source_key')
    .eq('id', id)
    .single()

  if (error || !s)
    return NextResponse.json({ error: error?.message || 'Not found' }, { status: 404 })

  return NextResponse.json({ supplier: s })
}
