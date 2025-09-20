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
 * Make sure the current user has at least one workspace.
 * If none exists, create "My Workspace" and add them as owner.
 * Returns the workspace ID or null if user not authenticated.
 */
export async function ensureWorkspace(): Promise<string | null> {
  const supabase = await createSupabaseServerClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth.user
  if (!user) return null

  // Try to find any visible workspace (member OR creator per policies)
  const { data: existing } = await supabase
    .from('workspaces')
    .select('id')
    .limit(1)

  if (existing && existing.length > 0) {
    return existing[0].id
  }

  // Create a default workspace
  const { data: ws } = await supabase
    .from('workspaces')
    .insert({ name: 'My Workspace', created_by: user.id })
    .select('id')
    .single()

  // If insert failed for any reason, just bail gracefully
  if (!ws) return null

  // Add the current user as owner (first membership)
  await supabase
    .from('workspace_members')
    .insert({ workspace_id: ws.id, user_id: user.id, role: 'owner' })

  return ws.id
}

/**
 * Only call this from Server Actions / Route Handlers!
 * Server components are not allowed to set cookies.
 */
export async function setCurrentWorkspaceId(id: string) {
  const c = await cookies()
  c.set({
    name: 'current_workspace_id',
    value: id,
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  })
}

/**
 * Fetch all workspaces the current user belongs to or created.
 */
export async function getMyWorkspaces() {
  const supabase = await createSupabaseServerClient()
  const { data } = await supabase
    .from('workspaces')
    .select('id, name, created_at')
  // No need to throw on empty/undefined; return an array
  return data || []
}
