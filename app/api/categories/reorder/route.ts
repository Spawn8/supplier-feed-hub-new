import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const workspaceId = await getCurrentWorkspaceId()
    if (!workspaceId) return NextResponse.json({ error: 'No workspace selected' }, { status: 400 })

    const body = await req.json()
    const { categories } = body

    if (!categories || !Array.isArray(categories)) {
      return NextResponse.json({ error: 'Categories array is required' }, { status: 400 })
    }

    console.log(`🔄 Reordering ${categories.length} categories for workspace ${workspaceId}`)
    console.log('Categories to update:', categories.map(c => ({ id: c.id, sort_order: c.sort_order })))

    // Update sort_order for each category individually
    for (const category of categories) {
      const { error } = await supabase
        .from('custom_categories')
        .update({ sort_order: category.sort_order })
        .eq('id', category.id)
        .eq('workspace_id', workspaceId)

      if (error) {
        console.error(`Error updating category ${category.id}:`, error)
        throw error
      }
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('Error reordering categories:', e)
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 })
  }
}
