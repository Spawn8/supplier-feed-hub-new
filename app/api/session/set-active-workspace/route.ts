// app/api/session/set-active-workspace/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

type Body = {
  workspace_id?: string
}

const COOKIE_NAME = 'active_workspace_id'

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Read body
  const body = (await req.json().catch(() => ({}))) as Body
  const workspace_id = (body.workspace_id || '').trim()
  if (!workspace_id) {
    return NextResponse.json(
      { error: 'workspace_id is required' },
      { status: 400 }
    )
  }

  // Validate membership
  const { data: membership, error: memErr } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .eq('workspace_id', workspace_id)
    .maybeSingle()

  if (memErr) {
    return NextResponse.json(
      { error: `Membership lookup failed: ${memErr.message}` },
      { status: 400 }
    )
  }

  if (!membership?.workspace_id) {
    return NextResponse.json(
      { error: 'You are not a member of this workspace' },
      { status: 403 }
    )
  }

  // Set cookie
  const res = NextResponse.json({ ok: true, workspace_id })
  const cookieStore = await cookies()
  const isProd = process.env.NODE_ENV === 'production'

  // overwrite if exists
  cookieStore.set({
    name: COOKIE_NAME,
    value: workspace_id,
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: 60 * 60 * 24 * 180, // 180 days
  })

  // Also set on response to make sure the browser updates immediately
  res.cookies.set({
    name: COOKIE_NAME,
    value: workspace_id,
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: 60 * 60 * 24 * 180,
  })

  return res
}
