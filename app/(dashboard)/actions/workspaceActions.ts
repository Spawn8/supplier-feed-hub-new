'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { setCurrentWorkspaceId } from '@/lib/workspace'

export async function createWorkspaceAction(formData: FormData) {
  const name = (formData.get('name') || '').toString().trim()
  if (!name) return { error: 'Workspace name is required.' }

  const supabase = await createSupabaseServerClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth.user
  if (!user) return { error: 'Not authenticated' }

  const { data: ws, error } = await supabase
    .from('workspaces')
    .insert({ name, created_by: user.id })
    .select('id')
    .single()

  if (error) return { error: error.message }

  await supabase.from('workspace_members').insert({ workspace_id: ws.id, user_id: user.id, role: 'owner' })
  await setCurrentWorkspaceId(ws.id)
  revalidatePath('/')
  redirect('/')
}

export async function switchWorkspaceAction(formData: FormData) {
  const id = (formData.get('workspace_id') || '').toString()
  if (!id) return { error: 'Missing workspace id' }
  await setCurrentWorkspaceId(id)
  revalidatePath('/')
  redirect('/')
}

export async function deleteWorkspaceAction(formData: FormData) {
  const id = (formData.get('workspace_id') || '').toString()
  if (!id) return { error: 'Missing workspace id' }
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.from('workspaces').delete().eq('id', id)
  if (error) return { error: error.message }
  await setCurrentWorkspaceId('')
  revalidatePath('/')
  redirect('/')
}
