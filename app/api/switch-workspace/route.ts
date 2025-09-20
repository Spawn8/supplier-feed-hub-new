import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  const { workspace_id } = await req.json()
  const c = await cookies()
  c.set({
    name: 'current_workspace_id',
    value: workspace_id,
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/'
  })
  return NextResponse.json({ ok: true })
}
