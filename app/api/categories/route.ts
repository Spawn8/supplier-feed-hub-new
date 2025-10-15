import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'

export async function GET(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const workspaceId = await getCurrentWorkspaceId()
    if (!workspaceId) return NextResponse.json({ error: 'No workspace selected' }, { status: 400 })

    const { data: categories, error } = await supabase
      .from('custom_categories')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('sort_order', { ascending: true })

    if (error) throw error

    return NextResponse.json({ categories })
  } catch (e: any) {
    console.error('Error fetching categories:', e)
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 })
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
      .insert({
        workspace_id: workspaceId,
        name,
        path: generatedPath,
        parent_id: parent_id || null,
        sort_order: sort_order || 0
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ category })
  } catch (e: any) {
    console.error('Error creating category:', e)
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 })
  }
}
