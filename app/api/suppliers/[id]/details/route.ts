import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: s, error } = await supabase
    .from('suppliers')
    .select('id, name, schedule, uid_source_key')
    .eq('id', params.id)
    .single()

  if (error || !s) return NextResponse.json({ error: error?.message || 'Not found' }, { status: 404 })
  return NextResponse.json(s)
}
