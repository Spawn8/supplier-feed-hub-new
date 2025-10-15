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

    const url = new URL(req.url)
    const supplierId = url.searchParams.get('supplier_id')

    let query = supabase
      .from('category_mappings')
      .select(`
        *,
        custom_categories (
          id,
          name,
          path
        )
      `)
      .eq('workspace_id', workspaceId)

    if (supplierId) {
      query = query.eq('supplier_id', supplierId)
    }

    const { data: mappings, error } = await query

    if (error) throw error

    return NextResponse.json({ mappings })
  } catch (e: any) {
    console.error('Error fetching category mappings:', e)
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
    const { supplier_id, supplier_category, workspace_category_id } = body

    if (!supplier_id || !supplier_category) {
      return NextResponse.json({ error: 'Supplier ID and supplier category are required' }, { status: 400 })
    }

    const normalizedCategory = (supplier_category || '').trim()

    const { data: mapping, error } = await supabase
      .from('category_mappings')
      .upsert(
        {
          workspace_id: workspaceId,
          supplier_id,
          supplier_category: normalizedCategory,
          workspace_category_id: workspace_category_id || null,
        },
        { onConflict: 'workspace_id,supplier_id,supplier_category' }
      )
      .select(`
        *,
        custom_categories (
          id,
          name,
          path
        )
      `)
      .single()

    if (error) throw error

    return NextResponse.json({ mapping })
  } catch (e: any) {
    console.error('Error creating category mapping:', e)
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 })
  }
}
