'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { setCurrentWorkspaceId } from '@/lib/workspace'

/**
 * Create a new workspace, add the current user as owner,
 * set it as the active workspace, and redirect to dashboard.
 */
export async function createWorkspaceAction(formData: FormData) {
  const name = (formData.get('name') || '').toString().trim()
  if (!name) return { error: 'Workspace name is required.' }

  const supabase = await createSupabaseServerClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth.user
  if (!user) return { error: 'Not authenticated' }

  // 1) Create workspace
  const { data: ws, error: wErr } = await supabase
    .from('workspaces')
    .insert({ name, created_by: user.id })
    .select('id')
    .single()

  if (wErr || !ws) return { error: wErr?.message || 'Failed to create workspace.' }

  // 2) Add membership (owner)
  const { error: mErr } = await supabase
    .from('workspace_members')
    .insert({ workspace_id: ws.id, user_id: user.id, role: 'owner' })
  if (mErr) return { error: mErr.message }

  // 3) Set cookie + redirect
  await setCurrentWorkspaceId(ws.id)
  revalidatePath('/')
  revalidatePath('/suppliers')
  redirect('/')
}

/**
 * Switch the active workspace. Verifies membership to avoid stale cookie issues.
 */
export async function switchWorkspaceAction(formData: FormData) {
  const id = (formData.get('workspace_id') || '').toString()
  if (!id) return { error: 'Missing workspace id' }

  const supabase = await createSupabaseServerClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth.user
  if (!user) return { error: 'Not authenticated' }

  // Verify the user is a member of the workspace
  const { data: mem, error: memErr } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('workspace_id', id)
    .eq('user_id', user.id)
    .limit(1)

  if (memErr || !mem || mem.length === 0) {
    return { error: 'You do not have access to this workspace.' }
  }

  await setCurrentWorkspaceId(id)
  revalidatePath('/')
  revalidatePath('/suppliers')
  redirect('/')
}

/**
 * Rename a workspace (only if the user is a member).
 * Adjust role checks in DB RLS if you want owner-only rename.
 */
export async function renameWorkspaceAction(formData: FormData) {
  const id = (formData.get('workspace_id') || '').toString()
  const name = (formData.get('name') || '').toString().trim()
  if (!id || !name) return { error: 'Missing workspace id or name' }

  const supabase = await createSupabaseServerClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth.user
  if (!user) return { error: 'Not authenticated' }

  // Optional: verify membership before update (defensive)
  const { data: mem } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('workspace_id', id)
    .eq('user_id', user.id)
    .limit(1)

  if (!mem || mem.length === 0) return { error: 'You do not have access to this workspace.' }

  const { error } = await supabase.from('workspaces').update({ name }).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/workspaces')
  return { ok: true }
}

/**
 * Delete a workspace, then:
 *  - If other workspaces remain where the user is a member, switch to the first one
 *  - Otherwise, clear the active workspace and send the user to /workspaces
 *
 * This avoids leaving a stale cookie pointing to a deleted workspace,
 * which would cause RLS errors on future inserts/reads.
 */
export async function deleteWorkspaceAction(formData: FormData) {
  const id = (formData.get('workspace_id') || '').toString()
  if (!id) return { error: 'Missing workspace id' }

  const supabase = await createSupabaseServerClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth.user
  if (!user) return { error: 'Not authenticated' }

  // 1) Delete the workspace
  const { error: delErr } = await supabase.from('workspaces').delete().eq('id', id)
  if (delErr) return { error: delErr.message }

  // 2) Look for any remaining workspace membership (excluding the deleted id)
  const { data: remain, error: rErr } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .neq('workspace_id', id)
    .limit(1)

  if (rErr) {
    // If this fails, clear and force the user to choose
    await setCurrentWorkspaceId('')
    revalidatePath('/workspaces')
    redirect('/workspaces')
  }

  // 3) Switch to the first remaining workspace, or clear if none
  if (remain && remain.length > 0) {
    await setCurrentWorkspaceId(remain[0].workspace_id)
    revalidatePath('/')
    revalidatePath('/suppliers')
    redirect('/')
  } else {
    await setCurrentWorkspaceId('') // clear cookie
    revalidatePath('/workspaces')
    redirect('/workspaces')
  }
}
