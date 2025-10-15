import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'
import { generateExport } from '@/lib/exports'

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const workspaceId = await getCurrentWorkspaceId()
    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace selected' }, { status: 400 })
    }

    const profileId = params.id

    // Get export profile
    const { data: profile, error: profileError } = await supabase
      .from('export_profiles')
      .select('*')
      .eq('id', profileId)
      .eq('workspace_id', workspaceId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Export profile not found' }, { status: 404 })
    }

    // Generate export
    const result = await generateExport(profile)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      export_id: result.exportId,
      download_url: result.downloadUrl
    })
  } catch (error: any) {
    console.error('Error generating export:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}