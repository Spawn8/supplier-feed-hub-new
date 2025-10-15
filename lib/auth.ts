// lib/auth.ts
import { createSupabaseServerClient } from './supabaseServer'
import { createSupabaseBrowserClient } from './supabaseClient'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export type UserRole = 'owner' | 'admin' | 'viewer'

export interface User {
  id: string
  email: string
  full_name?: string
  avatar_url?: string
  created_at: string
  updated_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: UserRole
  user: User
  invited_by?: string
  invited_at: string
  joined_at?: string
}

export interface Workspace {
  id: string
  name: string
  slug: string
  description?: string
  logo_url?: string
  default_currency: string
  default_language: string
  timezone: string
  billing_plan: string
  billing_status: string
  created_at: string
  updated_at: string
}

/**
 * Get the current authenticated user
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) return null
  
  return {
    id: user.id,
    email: user.email || '',
    full_name: user.user_metadata?.full_name,
    avatar_url: user.user_metadata?.avatar_url,
    created_at: user.created_at,
    updated_at: user.updated_at || user.created_at
  }
}

/**
 * Get all workspaces the current user belongs to
 */
export async function getUserWorkspaces(): Promise<Workspace[]> {
  const supabase = await createSupabaseServerClient()
  const user = await getCurrentUser()
  
  if (!user) return []
  
  const { data, error } = await supabase
    .from('workspace_members')
    .select(`
      workspace_id,
      role,
      workspaces (
        id,
        name,
        slug,
        description,
        logo_url,
        default_currency,
        default_language,
        timezone,
        billing_plan,
        billing_status,
        created_at,
        updated_at
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching user workspaces:', error)
    return []
  }
  
  return data?.map((item: any) => ({
    ...item.workspaces,
    user_role: item.role
  })) || []
}

/**
 * Get workspace members for a specific workspace
 */
export async function getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const supabase = await createSupabaseServerClient()
  
  const { data, error } = await supabase
    .from('workspace_members')
    .select(`
      id,
      workspace_id,
      user_id,
      role,
      invited_by,
      invited_at,
      joined_at,
      user:auth.users (
        id,
        email,
        raw_user_meta_data
      )
    `)
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching workspace members:', error)
    return []
  }
  
  return data?.map((item: any) => ({
    id: item.id,
    workspace_id: item.workspace_id,
    user_id: item.user_id,
    role: item.role,
    user: {
      id: item.user.id,
      email: item.user.email,
      full_name: item.user.raw_user_meta_data?.full_name,
      avatar_url: item.user.raw_user_meta_data?.avatar_url,
      created_at: item.user.created_at,
      updated_at: item.user.updated_at || item.user.created_at
    },
    invited_by: item.invited_by,
    invited_at: item.invited_at,
    joined_at: item.joined_at
  })) || []
}

/**
 * Check if user has permission for a workspace
 */
export async function hasWorkspacePermission(
  workspaceId: string, 
  requiredRole: UserRole = 'viewer'
): Promise<{ hasPermission: boolean; role?: UserRole }> {
  const supabase = await createSupabaseServerClient()
  const user = await getCurrentUser()
  
  if (!user) return { hasPermission: false }
  
  const { data, error } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()
  
  if (error || !data) return { hasPermission: false }
  
  const role = data.role as UserRole
  const roleHierarchy = { viewer: 1, admin: 2, owner: 3 }
  const requiredLevel = roleHierarchy[requiredRole]
  const userLevel = roleHierarchy[role]
  
  return {
    hasPermission: userLevel >= requiredLevel,
    role
  }
}

/**
 * Require authentication - redirect to login if not authenticated
 */
export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/login')
  }
  
  return user
}

/**
 * Require workspace permission - redirect if not authorized
 */
export async function requireWorkspacePermission(
  workspaceId: string, 
  requiredRole: UserRole = 'viewer'
): Promise<{ user: User; role: UserRole }> {
  const user = await requireAuth()
  const { hasPermission, role } = await hasWorkspacePermission(workspaceId, requiredRole)
  
  if (!hasPermission || !role) {
    redirect('/workspaces')
  }
  
  return { user, role }
}

/**
 * Invite user to workspace
 */
export async function inviteUserToWorkspace(
  workspaceId: string,
  email: string,
  role: UserRole = 'viewer'
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient()
  const user = await getCurrentUser()
  
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }
  
  // Check if user has admin/owner permission
  const { hasPermission } = await hasWorkspacePermission(workspaceId, 'admin')
  if (!hasPermission) {
    return { success: false, error: 'Insufficient permissions' }
  }
  
  // Check if user already exists
  const { data: existingUser } = await supabase.auth.admin.getUserByEmail(email)
  
  if (existingUser.user) {
    // User exists, add them directly
    const { error } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspaceId,
        user_id: existingUser.user.id,
        role,
        invited_by: user.id
      })
    
    if (error) {
      return { success: false, error: error.message }
    }
  } else {
    // User doesn't exist, create invitation
    // Note: In a real implementation, you'd send an email invitation
    // For now, we'll just create a pending invitation record
    const { error } = await supabase
      .from('workspace_invitations')
      .insert({
        workspace_id: workspaceId,
        email,
        role,
        invited_by: user.id,
        token: crypto.randomUUID(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      })
    
    if (error) {
      return { success: false, error: error.message }
    }
  }
  
  return { success: true }
}

/**
 * Remove user from workspace
 */
export async function removeUserFromWorkspace(
  workspaceId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient()
  const user = await getCurrentUser()
  
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }
  
  // Check if user has admin/owner permission
  const { hasPermission } = await hasWorkspacePermission(workspaceId, 'admin')
  if (!hasPermission) {
    return { success: false, error: 'Insufficient permissions' }
  }
  
  // Don't allow removing the last owner
  const { data: owners } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('role', 'owner')
  
  if (owners && owners.length === 1) {
    const { data: memberToRemove } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single()
    
    if (memberToRemove?.role === 'owner') {
      return { success: false, error: 'Cannot remove the last owner' }
    }
  }
  
  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
  
  if (error) {
    return { success: false, error: error.message }
  }
  
  return { success: true }
}

/**
 * Update user role in workspace
 */
export async function updateUserRole(
  workspaceId: string,
  userId: string,
  newRole: UserRole
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createSupabaseServerClient()
  const user = await getCurrentUser()
  
  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }
  
  // Check if user has admin/owner permission
  const { hasPermission } = await hasWorkspacePermission(workspaceId, 'admin')
  if (!hasPermission) {
    return { success: false, error: 'Insufficient permissions' }
  }
  
  // Don't allow demoting the last owner
  if (newRole !== 'owner') {
    const { data: owners } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('role', 'owner')
    
    if (owners && owners.length === 1) {
      const { data: memberToUpdate } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .single()
      
      if (memberToUpdate?.role === 'owner') {
        return { success: false, error: 'Cannot demote the last owner' }
      }
    }
  }
  
  const { error } = await supabase
    .from('workspace_members')
    .update({ role: newRole })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
  
  if (error) {
    return { success: false, error: error.message }
  }
  
  return { success: true }
}

/**
 * Get user's role in a workspace
 */
export async function getUserWorkspaceRole(workspaceId: string): Promise<UserRole | null> {
  const supabase = await createSupabaseServerClient()
  const user = await getCurrentUser()
  
  if (!user) return null
  
  const { data, error } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single()
  
  if (error || !data) return null
  
  return data.role as UserRole
}

/**
 * Check if user can perform action based on role
 */
export function canPerformAction(userRole: UserRole, action: string): boolean {
  const permissions = {
    viewer: ['read'],
    admin: ['read', 'write', 'manage_users', 'manage_settings'],
    owner: ['read', 'write', 'manage_users', 'manage_settings', 'manage_billing', 'delete_workspace']
  }
  
  return permissions[userRole]?.includes(action) || false
}

/**
 * Log user activity
 */
export async function logActivity(
  workspaceId: string,
  action: string,
  resourceType?: string,
  resourceId?: string,
  details?: Record<string, any>
): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const user = await getCurrentUser()
  
  if (!user) return
  
  await supabase
    .from('activity_logs')
    .insert({
      workspace_id: workspaceId,
      user_id: user.id,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details: details || {}
    })
}
