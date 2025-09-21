// lib/workspace.ts
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from './supabaseServer'

/**
 * Read the currently active workspace ID from cookie.
 */
export async function getCurrentWorkspaceId(): Promise<string | null> {
  const c = await cookies()
  return c.get('current_workspace_id')?.value ?? null
}

/**
 * Set/clear the active workspace cookie (server-side).
 * httpOnly=false so client components (e.g., sidebar) can also read it if needed.
 */
export async function setCurrentWorkspaceId(id: string) {
  const c = await cookies()
  c.set({
    name: 'current_workspace_id',
    value: id,
    httpOnly: false,
    sameSite: 'lax',
    maxAge: id ? 60 * 60 * 24 * 30 : 0,
    path: '/',
  })
}

/**
 * Ensure we have a valid active workspace for the logged-in user.
 * - If the cookie points to a workspace the user no longer belongs to,
 *   it picks the first available membership and sets that.
 * - If none found, clears the cookie and returns null.
 * Use this at the top of server pages that require a workspace (e.g., dashboard).
 */
export async function ensureActiveWorkspace(): Promise<string | null> {
  const supabase = await createSupabaseServerClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth.user
  if (!user) return null

  const current = await getCurrentWorkspaceId()
  if (current) {
    const { data: mem } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('workspace_id', current)
      .eq('user_id', user.id)
      .limit(1)

    if (mem && mem.length > 0) {
      return current
    }
  }

  // Pick another workspace the user belongs to
  const { data: others } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)

  if (others && others.length > 0) {
    const next = others[0].workspace_id as string
    await setCurrentWorkspaceId(next)
    return next
  }

  // None left
  await setCurrentWorkspaceId('')
  return null
}

/**
 * Fetch all workspaces the current user belongs to or created.
 */
export async function getMyWorkspaces() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('workspaces')
    .select('id, name, created_at')
  return data || []
}
