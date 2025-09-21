'use server'

import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'

export type CreateSupplierState = { ok?: boolean; error?: string }
export type UpdateSupplierState = { ok?: boolean; error?: string }
export type DeleteSupplierState = { ok?: boolean; error?: string }

/**
 * CREATE supplier
 * - Handles URL or File upload (XML/CSV/JSON)
 * - Requires active workspace (RLS safe)
 * - Stores optional schedule + auth credentials
 */
export async function createSupplierAction(
  _prev: CreateSupplierState,
  formData: FormData
): Promise<CreateSupplierState> {
  try {
    const name = (formData.get('name') || '').toString().trim()
    const sourceType = (formData.get('source_type') || '').toString() as 'url' | 'upload'
    const endpointUrl = (formData.get('endpoint_url') || '').toString().trim()
    const file = formData.get('file') as File | null
    const schedule = (formData.get('schedule') || '').toString().trim() || null
    const authUsername = (formData.get('auth_username') || '').toString().trim() || null
    const authPassword = (formData.get('auth_password') || '').toString().trim() || null

    if (!name) return { error: 'Name is required.' }
    if (!['url', 'upload'].includes(sourceType)) return { error: 'Invalid source type.' }
    if (sourceType === 'url' && !endpointUrl) return { error: 'Endpoint URL is required.' }
    if (sourceType === 'upload' && !file) return { error: 'File is required.' }

    const supabase = await createSupabaseServerClient()
    const wsId = await getCurrentWorkspaceId()
    if (!wsId) return { error: 'No active workspace.' }

    let source_path: string | null = null

    // Upload file if sourceType=upload
    if (sourceType === 'upload' && file) {
      const bytes = Buffer.from(await file.arrayBuffer())
      const ext = (file.name.split('.').pop() || 'xml').toLowerCase()
      const objectName = `${wsId}/${randomUUID()}.${ext}`

      const { error: upErr } = await supabase.storage
        .from('feeds')
        .upload(objectName, bytes, {
          contentType:
            file.type ||
            (ext === 'csv'
              ? 'text/csv'
              : ext === 'json'
              ? 'application/json'
              : 'application/xml'),
          upsert: false,
        })

      if (upErr) return { error: `Upload failed: ${upErr.message}` }
      source_path = objectName
    }

    // Insert into DB
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
 * - Changes metadata (name, URL, schedule, auth, type)
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

    if (!id) return { error: 'Missing supplier id.' }
    if (!name) return { error: 'Name is required.' }
    if (!['url', 'upload'].includes(sourceType)) return { error: 'Invalid source type.' }
    if (sourceType === 'url' && !endpointUrl)
      return { error: 'Endpoint URL is required for URL type.' }

    const supabase = await createSupabaseServerClient()
    const wsId = await getCurrentWorkspaceId()
    if (!wsId) return { error: 'No active workspace.' }

    const payload: Record<string, any> = {
      name,
      source_type: sourceType,
      endpoint_url: sourceType === 'url' ? endpointUrl : null,
      schedule,
      auth_username: authUsername,
      auth_password: authPassword,
    }

    const { error } = await supabase
      .from('suppliers')
      .update(payload)
      .eq('id', id)
      .eq('workspace_id', wsId)

    if (error) return { error: error.message }

    revalidatePath('/suppliers')
    return { ok: true }
  } catch (e: any) {
    return { error: e?.message || 'Unexpected error.' }
  }
}

/**
 * DELETE supplier
 * - Removes row
 * - If type=upload, deletes storage object too
 */
export async function deleteSupplierAction(formData: FormData): Promise<DeleteSupplierState> {
  try {
    const id = (formData.get('supplier_id') || '').toString()
    if (!id) return { error: 'Missing supplier id.' }

    const supabase = await createSupabaseServerClient()
    const wsId = await getCurrentWorkspaceId()
    if (!wsId) return { error: 'No active workspace.' }

    const { data: supplier, error: selErr } = await supabase
      .from('suppliers')
      .select('id, source_type, source_path, workspace_id')
      .eq('id', id)
      .eq('workspace_id', wsId)
      .single()

    if (selErr) return { error: selErr.message }
    if (!supplier) return { error: 'Supplier not found.' }

    // Delete DB row
    const { error: delErr } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id)
      .eq('workspace_id', wsId)

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
