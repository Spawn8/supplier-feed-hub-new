import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const workspaceId = await getCurrentWorkspaceId()
    if (!workspaceId) return NextResponse.json({ error: 'No workspace selected' }, { status: 400 })

    const { id } = await params
    const body = await req.json()
    const { name, path, parent_id, sort_order } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    // Generate path automatically if not provided
    let generatedPath = path
    if (!generatedPath) {
      if (!parent_id) {
        generatedPath = name
      } else {
        // Get parent category to build path
        const { data: parentCategory } = await supabase
          .from('custom_categories')
          .select('path')
          .eq('id', parent_id)
          .eq('workspace_id', workspaceId)
          .single()
        
        if (parentCategory) {
          generatedPath = `${parentCategory.path} > ${name}`
        } else {
          generatedPath = name
        }
      }
    }

    const { data: category, error } = await supabase
      .from('custom_categories')
      .update({
        name,
        path: generatedPath,
        parent_id: parent_id || null,
        sort_order: sort_order || 0
      })
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ category })
  } catch (e: any) {
    console.error('Error updating category:', e)
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const workspaceId = await getCurrentWorkspaceId()
    if (!workspaceId) return NextResponse.json({ error: 'No workspace selected' }, { status: 400 })

    const { id } = await params

    // First, check if there are any child categories
    const { data: childCategories } = await supabase
      .from('custom_categories')
      .select('id')
      .eq('parent_id', id)
      .eq('workspace_id', workspaceId)

    if (childCategories && childCategories.length > 0) {
      return NextResponse.json({ 
        error: 'Cannot delete category that has subcategories. Please delete subcategories first.' 
      }, { status: 400 })
    }

    // Delete all category mappings that reference this category
    const { error: mappingsError } = await supabase
      .from('category_mappings')
      .delete()
      .eq('workspace_category_id', id)
      .eq('workspace_id', workspaceId)

    if (mappingsError) {
      console.error('Error deleting category mappings:', mappingsError)
      throw mappingsError
    }

    // Update products that reference this category to set category_id to null
    const { error: productsError } = await supabase
      .from('products_final')
      .update({ category_id: null })
      .eq('category_id', id)
      .eq('workspace_id', workspaceId)

    if (productsError) {
      console.error('Error updating products:', productsError)
      throw productsError
    }

    // Now delete the category itself
    const { error } = await supabase
      .from('custom_categories')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('Error deleting category:', e)
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 })
  }
}
