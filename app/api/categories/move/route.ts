import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'

// Helper function to update child paths recursively
async function updateChildPaths(supabase: any, parentId: string, parentPath: string, workspaceId: string) {
  // Get all direct children of the parent
  const { data: children, error } = await supabase
    .from('custom_categories')
    .select('id, name')
    .eq('parent_id', parentId)
    .eq('workspace_id', workspaceId)

  if (error) throw error

  // Update each child's path
  for (const child of children || []) {
    const childPath = `${parentPath}/${child.name}`
    
    const { error: updateError } = await supabase
      .from('custom_categories')
      .update({ path: childPath })
      .eq('id', child.id)

    if (updateError) throw updateError

    // Recursively update grandchildren
    await updateChildPaths(supabase, child.id, childPath, workspaceId)
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const workspaceId = await getCurrentWorkspaceId()
    if (!workspaceId) return NextResponse.json({ error: 'No workspace selected' }, { status: 400 })

    const body = await req.json()
    const { subcategoryId, newParentId } = body

    if (!subcategoryId || !newParentId) {
      return NextResponse.json({ error: 'Subcategory ID and new parent ID are required' }, { status: 400 })
    }

    // Get the subcategory to move
    const { data: subcategory, error: subcategoryError } = await supabase
      .from('custom_categories')
      .select('*')
      .eq('id', subcategoryId)
      .eq('workspace_id', workspaceId)
      .single()

    if (subcategoryError) throw subcategoryError
    if (!subcategory) {
      return NextResponse.json({ error: 'Subcategory not found' }, { status: 404 })
    }

    // Get the new parent category
    const { data: newParent, error: parentError } = await supabase
      .from('custom_categories')
      .select('*')
      .eq('id', newParentId)
      .eq('workspace_id', workspaceId)
      .single()

    if (parentError) throw parentError
    if (!newParent) {
      return NextResponse.json({ error: 'New parent category not found' }, { status: 404 })
    }

    // Update the subcategory's parent_id
    const { error: updateError } = await supabase
      .from('custom_categories')
      .update({ parent_id: newParentId })
      .eq('id', subcategoryId)

    if (updateError) throw updateError

    // Update the path to reflect the new parent hierarchy
    const newPath = newParent.path ? `${newParent.path}/${subcategory.name}` : subcategory.name
    
    const { error: pathUpdateError } = await supabase
      .from('custom_categories')
      .update({ path: newPath })
      .eq('id', subcategoryId)

    if (pathUpdateError) throw pathUpdateError

    // Update all child categories' paths recursively
    await updateChildPaths(supabase, subcategoryId, newPath, workspaceId)

    return NextResponse.json({ success: true, message: 'Subcategory moved successfully' })
  } catch (e: any) {
    console.error('Error moving subcategory:', e)
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 })
  }
}
