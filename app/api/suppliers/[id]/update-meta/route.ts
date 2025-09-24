import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = await createSupabaseServerClient()
  const body = await req.json()
  const { name, schedule } = body

  const { error } = await supabase
    .from('suppliers')
    .update({
      name,
      schedule,
      is_draft: false,   // 👈 mark complete
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
