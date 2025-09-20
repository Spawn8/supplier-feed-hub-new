'use server'

import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'

export type CreateSupplierState = { ok?: boolean; error?: string }

export async function createSupplierAction(
  _prev: CreateSupplierState,
  formData: FormData
): Promise<CreateSupplierState> {
  const name = (formData.get('name') || '').toString().trim()
  const sourceType = (formData.get('source_type') || '').toString().trim() as 'url' | 'upload'
  const endpointUrl = (formData.get('endpoint_url') || '').toString().trim()
  const file = formData.get('file') as File | null
  const schedule = (formData.get('schedule') || '').toString().trim()
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

  try {
    if (sourceType === 'upload' && file) {
      const bytes = Buffer.from(await file.arrayBuffer())
      const ext = (file.name.split('.').pop() || 'xml').toLowerCase()
      const objectName = `${wsId}/${randomUUID()}.${ext}`

      const { error: upErr } = await supabase.storage
        .from('feeds')
        .upload(objectName, bytes, {
          contentType: file.type || (ext === 'csv' ? 'text/csv' : 'application/xml'),
          upsert: false
        })

      if (upErr) return { error: `Upload failed: ${upErr.message}` }
      source_path = objectName
    }

    const { error: insErr } = await supabase.from('suppliers').insert({
      workspace_id: wsId,
      name,
      source_type: sourceType,
      endpoint_url: sourceType === 'url' ? endpointUrl : null,
      source_path,
      schedule: schedule || null,
      auth_username: authUsername,
      auth_password: authPassword
    })

    if (insErr) return { error: insErr.message }
  } catch (e: any) {
    return { error: e?.message || 'Unexpected error.' }
  }

  revalidatePath('/suppliers')
  return { ok: true }
}

export async function deleteSupplierAction(formData: FormData) {
  const id = (formData.get('supplier_id') || '').toString()
  if (!id) return { error: 'Missing supplier id' }
  const supabase = await createSupabaseServerClient()

  const { data: supplier } = await supabase
    .from('suppliers')
    .select('id, source_type, source_path')
    .eq('id', id)
    .single()

  const { error } = await supabase.from('suppliers').delete().eq('id', id)
  if (error) return { error: error.message }

  if (supplier?.source_type === 'upload' && supplier.source_path) {
    await supabase.storage.from('feeds').remove([supplier.source_path])
  }

  revalidatePath('/suppliers')
  return { ok: true }
}
