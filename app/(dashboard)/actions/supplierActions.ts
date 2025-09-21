'use server'

import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'

export type CreateSupplierState = { ok?: boolean; error?: string }
export type UpdateSupplierState = { ok?: boolean; error?: string }
export type DeleteSupplierState = { ok?: boolean; error?: string }

/**
 * Internal: verify the current user is a member of a given workspace.
 * Returns true/false without throwing (avoids .single() pitfalls).
 */
async function userHasMembership(supabase: any, userId: string, workspaceId: string) {
  const { data, error } = await supabase
    .from('workspace_members')
    .select('workspace_id', { count: 'exact', head: false })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .limit(1)

  if (error) return false
  return Array.isArray(data) && data.length > 0
}

/**
 * CREATE supplier
 * - Handles URL or File upload (XML/CSV/JSON)
 * - Requires active workspace (RLS safe)
 * - Stores optional schedule + auth credentials
 * - Verifies membership to avoid stale-cookie RLS errors
 */
export async function createSupplierAction(
  _prev: CreateSupplierState,
  formData: FormData
): Promise<CreateSupplierState> {
  try {
    const name = (formData.get('name') || '').toString().trim()
    const sourceType = (formData.get('source_type') || '').toString() as 'url' | 'upload'
    const endpointUrl = (formData.get('endpoint_url') || '').toString().trim()
    const schedule = (formData.get('schedule') || '').toString().trim() || null
    const authUsername = (formData.get('auth_username') || '').toString().trim() || null
    const authPassword = (formData.get('auth_password') || '').toString().trim() || null
    const file = formData.get('file') as File | null

    if (!name) return { error: 'Name is required.' }
    if (!['url', 'upload'].includes(sourceType)) return { error: 'Invalid source type.' }
    if (sourceType === 'url' && !endpointUrl) return { error: 'Endpoint URL is required.' }
    if (sourceType === 'upload' && !file) return { error: 'File is required.' }

    const supabase = await createSupabaseServerClient()

    // Auth
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) return { error: 'Not authenticated.' }

    // Workspace
    const wsId = await getCurrentWorkspaceId()
    if (!wsId) return { error: 'No active workspace.' }

    // Verify membership (defensive against stale cookies)
    const isMember = await userHasMembership(supabase, user.id, wsId)
    if (!isMember) {
      return { error: 'You no longer have access to the selected workspace. Please switch workspace.' }
    }

    // Optional upload
    let source_path: string | null = null
    if (sourceType === 'upload' && file) {
      const bytes = Buffer.from(await file.arrayBuffer())
      const ext = (file.name.split('.').pop() || 'xml').toLowerCase()
      const contentType =
        ext === 'xml' ? 'application/xml' :
        ext === 'csv' ? 'text/csv' :
        ext === 'json' ? 'application/json' :
        'application/octet-stream'

      const objectName = `${wsId}/${randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage.from('feeds').upload(objectName, bytes, { contentType })
      if (upErr) return { error: `Upload failed: ${upErr.message}` }
      source_path = objectName
    }

    // Insert into DB (RLS requires correct workspace_id and membership)
    const { error: insErr } = await supabase.from('suppliers').insert({
      workspace_id: wsId,
      name,
      source_type: sourceType,
      endpoint_url: sourceType === 'url' ? endpointUrl : null,
      source_path,
      schedule,
      auth_username: authUsername,
      auth_password: authPassword,
    })
    if (insErr) return { error: insErr.message }

    revalidatePath('/suppliers')
    return { ok: true }
  } catch (e: any) {
    return { error: e?.message || 'Unexpected error.' }
  }
}

/**
 * UPDATE supplier
 * - Allows switching between URL/UPLOAD and replacing file (optional)
 * - Verifies membership to avoid RLS issues after workspace changes
 */
export async function updateSupplierAction(
  _prev: UpdateSupplierState,
  formData: FormData
): Promise<UpdateSupplierState> {
  try {
    const id = (formData.get('id') || '').toString()
    const name = (formData.get('name') || '').toString().trim()
    const sourceType = (formData.get('source_type') || '').toString() as 'url' | 'upload'
    const endpointUrl = (formData.get('endpoint_url') || '').toString().trim() || null
    const schedule = (formData.get('schedule') || '').toString().trim() || null
    const authUsername = (formData.get('auth_username') || '').toString().trim() || null
    const authPassword = (formData.get('auth_password') || '').toString().trim() || null
    const file = formData.get('file') as File | null

    if (!id) return { error: 'Missing supplier id.' }
    if (!name) return { error: 'Name is required.' }
    if (!['url', 'upload'].includes(sourceType)) return { error: 'Invalid source type.' }
    if (sourceType === 'url' && !endpointUrl) return { error: 'Endpoint URL is required for URL type.' }

    const supabase = await createSupabaseServerClient()

    // Auth
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) return { error: 'Not authenticated.' }

    // Workspace
    const wsId = await getCurrentWorkspaceId()
    if (!wsId) return { error: 'No active workspace.' }

    // Verify membership
    const isMember = await userHasMembership(supabase, user.id, wsId)
    if (!isMember) {
      return { error: 'You no longer have access to the selected workspace. Please switch workspace.' }
    }

    // Fetch existing supplier (for file cleanup logic & RLS-safe access)
    const { data: supplier, error: getErr } = await supabase
      .from('suppliers')
      .select('id, source_type, source_path')
      .eq('id', id)
      .eq('workspace_id', wsId)
      .single()

    if (getErr || !supplier) return { error: getErr?.message || 'Supplier not found.' }

    let next_source_path: string | null | undefined = undefined

    // If switching to upload or replacing file, upload new one
    if (sourceType === 'upload' && file) {
      const bytes = Buffer.from(await file.arrayBuffer())
      const ext = (file.name.split('.').pop() || 'xml').toLowerCase()
      const contentType =
        ext === 'xml' ? 'application/xml' :
        ext === 'csv' ? 'text/csv' :
        ext === 'json' ? 'application/json' :
        'application/octet-stream'

      const objectName = `${wsId}/${randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage.from('feeds').upload(objectName, bytes, { contentType })
      if (upErr) return { error: `Upload failed: ${upErr.message}` }
      next_source_path = objectName
    } else if (sourceType === 'url') {
      // If switching to URL, null out any previous source_path
      next_source_path = null
    }

    // Build update payload
    const updatePayload: any = {
      name,
      source_type: sourceType,
      endpoint_url: sourceType === 'url' ? endpointUrl : null,
      schedule,
      auth_username: authUsername,
      auth_password: authPassword,
    }
    if (next_source_path !== undefined) {
      updatePayload.source_path = next_source_path
    }

    const { error: updErr } = await supabase
      .from('suppliers')
      .update(updatePayload)
      .eq('id', id)
      .eq('workspace_id', wsId)

    if (updErr) return { error: updErr.message }

    // If we replaced file successfully and the old was upload, clean it up
    if (sourceType === 'upload' && next_source_path && supplier.source_type === 'upload' && supplier.source_path) {
      await supabase.storage.from('feeds').remove([supplier.source_path])
    }

    revalidatePath('/suppliers')
    return { ok: true }
  } catch (e: any) {
    return { error: e?.message || 'Unexpected error.' }
  }
}

/**
 * DELETE supplier
 * - Deletes DB row
 * - If it had an uploaded file, removes it from storage
 */
export async function deleteSupplierAction(formData: FormData): Promise<DeleteSupplierState> {
  try {
    const id = (formData.get('supplier_id') || '').toString()
    if (!id) return { error: 'Missing supplier id.' }

    const supabase = await createSupabaseServerClient()

    // Auth
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) return { error: 'Not authenticated.' }

    // Workspace
    const wsId = await getCurrentWorkspaceId()
    if (!wsId) return { error: 'No active workspace.' }

    // Get supplier (RLS-safe)
    const { data: supplier, error: getErr } = await supabase
      .from('suppliers')
      .select('id, source_type, source_path')
      .eq('id', id)
      .eq('workspace_id', wsId)
      .single()
    if (getErr || !supplier) return { error: getErr?.message || 'Supplier not found.' }

    // Delete row
    const { error: delErr } = await supabase.from('suppliers').delete().eq('id', id).eq('workspace_id', wsId)
    if (delErr) return { error: delErr.message }

    // Remove file from storage if uploaded
    if (supplier.source_type === 'upload' && supplier.source_path) {
      await supabase.storage.from('feeds').remove([supplier.source_path])
    }

    revalidatePath('/suppliers')
    return { ok: true }
  } catch (e: any) {
    return { error: e?.message || 'Unexpected error.' }
  }
}
