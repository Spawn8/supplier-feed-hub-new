import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { id: workspaceId } = await params

    // Fetch stats for the workspace
    const [suppliersResult, fieldsResult, exportsResult] = await Promise.all([
      supabase
        .from('suppliers')
        .select('id', { count: 'exact' })
        .eq('workspace_id', workspaceId),
      
      supabase
        .from('custom_fields')
        .select('id', { count: 'exact' })
        .eq('workspace_id', workspaceId),
      
      supabase
        .from('exports')
        .select('id', { count: 'exact' })
        .eq('workspace_id', workspaceId)
    ])

    const stats = {
      suppliers: suppliersResult.count || 0,
      fields: fieldsResult.count || 0,
      exports: exportsResult.count || 0
    }

    return NextResponse.json({ stats })
  } catch (error: any) {
    console.error('Error fetching workspace stats:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}
