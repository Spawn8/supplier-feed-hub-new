import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'
import { generateExportPreview } from '@/lib/exports'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const workspaceId = await getCurrentWorkspaceId()
    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace selected' }, { status: 400 })
    }

    // Get limit from query params
    const url = new URL(req.url)
    const limit = parseInt(url.searchParams.get('limit') || '10')

    // Verify export profile belongs to workspace
    const { data: profile } = await supabase
      .from('export_profiles')
      .select('id, workspace_id')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Export profile not found' }, { status: 404 })
    }

    // Generate preview
    const result = await generateExportPreview(id, limit)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      data: result.data 
    })
  } catch (error: any) {
    console.error('Error generating export preview:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}
