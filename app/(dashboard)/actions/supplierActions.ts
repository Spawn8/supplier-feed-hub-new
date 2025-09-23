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
  try {
    const { data } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId)
      .limit(1)
    return !!(data && data.length > 0)
  } catch {
    return false
  }
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

    // Upload file if needed
    let source_path: string | null = null
    if (sourceType === 'upload' && file) {
      const bytes = await file.arrayBuffer()
      const buf = Buffer.from(bytes)
      const ext =
        file.type.includes('xml') ? 'xml' :
        file.type.includes('csv') ? 'csv' :
        file.type.includes('json') ? 'json' :
        'bin'
      const contentType =
        ext === 'xml' ? 'application/xml' :
        ext === 'csv' ? 'text/csv' :
        ext === 'json' ? 'application/json' :
        'application/octet-stream'

      const objectName = `${wsId}/${randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage.from('feeds').upload(objectName, buf, { contentType })
      if (upErr) return { error: `Upload failed: ${upErr.message}` }
      source_path = objectName
    }

    // Compute next display_no within this workspace
    let nextDisplayNo = 1
    {
      const { data: maxRow } = await supabase
        .from('suppliers')
        .select('display_no')
        .eq('workspace_id', wsId)
        .order('display_no', { ascending: false })
        .limit(1)
        .maybeSingle()
      nextDisplayNo = (maxRow?.display_no ?? 0) + 1
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
      display_no: nextDisplayNo,
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
  formData: FormData
): Promise<UpdateSupplierState> {
  try {
    const id = (formData.get('id') || '').toString()
    const name = (formData.get('name') || '').toString().trim()
    const sourceType = (formData.get('source_type') || '').toString() as 'url' | 'upload'
    const endpointUrl = (formData.get('endpoint_url') || '').toString().trim()
    const schedule = (formData.get('schedule') || '').toString().trim() || null
    const authUsername = (formData.get('auth_username') || '').toString().trim() || null
    const authPassword = (formData.get('auth_password') || '').toString().trim() || null
    const file = formData.get('file') as File | null

    if (!id) return { error: 'Missing supplier id.' }
    if (!name) return { error: 'Name is required.' }
    if (!['url', 'upload'].includes(sourceType)) return { error: 'Invalid source type.' }
    if (sourceType === 'url' && !endpointUrl) return { error: 'Endpoint URL is required.' }

    const supabase = await createSupabaseServerClient()
    const { data: auth } = await supabase.auth.getUser()
    const user = auth.user
    if (!user) return { error: 'Not authenticated.' }

    const wsId = await getCurrentWorkspaceId()
    if (!wsId) return { error: 'No active workspace.' }

    const isMember = await userHasMembership(supabase, user.id, wsId)
    if (!isMember) {
      return { error: 'You no longer have access to the selected workspace. Please switch workspace.' }
    }

    const { data: supplier, error: getErr } = await supabase
      .from('suppliers')
      .select('id, source_type, source_path')
      .eq('id', id)
      .eq('workspace_id', wsId)
      .single()
    if (getErr) return { error: getErr.message }

    let source_path = supplier.source_path
    if (sourceType === 'upload' && file) {
      const bytes = await file.arrayBuffer()
      const buf = Buffer.from(bytes)
      const ext =
        file.type.includes('xml') ? 'xml' :
        file.type.includes('csv') ? 'csv' :
        file.type.includes('json') ? 'json' :
        'bin'
      const contentType =
        ext === 'xml' ? 'application/xml' :
        ext === 'csv' ? 'text/csv' :
        ext === 'json' ? 'application/json' :
        'application/octet-stream'

      // NOTE: optional — keep existing objectName or write a new one
      const objectName = supplier.source_path || `${wsId}/${randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage.from('feeds').upload(objectName, buf, { contentType, upsert: true })
      if (upErr) return { error: `Upload failed: ${upErr.message}` }
      source_path = objectName
    }

    const { error: updErr } = await supabase.from('suppliers').update({
      name,
      source_type: sourceType,
      endpoint_url: sourceType === 'url' ? endpointUrl : null,
      source_path,
      schedule,
      auth_username: authUsername,
      auth_password: authPassword,
    }).eq('id', id).eq('workspace_id', wsId)

    if (updErr) return { error: updErr.message }

    revalidatePath('/suppliers')
    return { ok: true }
  } catch (e: any) {
    return { error: e?.message || 'Unexpected error.' }
  }
}

/**
 * DELETE supplier
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

    // Fetch row for storage cleanup
    const { data: supplier, error: getErr } = await supabase
      .from('suppliers')
      .select('id, source_type, source_path')
      .eq('id', id)
      .eq('workspace_id', wsId)
      .single()
    if (getErr) return { error: getErr.message }

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
