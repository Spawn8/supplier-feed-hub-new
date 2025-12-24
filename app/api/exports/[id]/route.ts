import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'
import { updateExportProfile, deleteExportProfile } from '@/lib/exports'

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
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

    const { id: profileId } = await params
    const body = await req.json()

    const {
      name,
      description,
      output_format,
      platform,
      field_selection,
      field_ordering,
      filters,
      template_config,
      file_naming,
      delivery_method,
      delivery_config,
      is_active
    } = body

    // Validate required fields
    if (!name || !output_format || !field_selection) {
      return NextResponse.json({ 
        error: 'Name, output format, and field selection are required' 
      }, { status: 400 })
    }

    // Validate output format
    const validFormats = ['csv', 'json', 'xml']
    if (!validFormats.includes(output_format)) {
      return NextResponse.json({ 
        error: 'Invalid output format. Must be one of: ' + validFormats.join(', ') 
      }, { status: 400 })
    }

    // Validate platform if provided
    if (platform) {
      const validPlatforms = ['woocommerce', 'shopify', 'magento', 'custom']
      if (!validPlatforms.includes(platform)) {
        return NextResponse.json({ 
          error: 'Invalid platform. Must be one of: ' + validPlatforms.join(', ') 
        }, { status: 400 })
      }
    }

    // Update export profile
    const result = await updateExportProfile(profileId, {
      name,
      description,
      output_format,
      platform,
      field_selection,
      field_ordering,
      filters,
      template_config,
      file_naming,
      delivery_method,
      delivery_config,
      is_active
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      profile: result.profile 
    })
  } catch (error: any) {
    console.error('Error updating export profile:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
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

    const { id: profileId } = await params

    // Verify profile exists and belongs to workspace
    const { data: profile, error: profileError } = await supabase
      .from('export_profiles')
      .select('id')
      .eq('id', profileId)
      .eq('workspace_id', workspaceId)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Export profile not found' }, { status: 404 })
    }

    // Delete export profile
    const result = await deleteExportProfile(profileId)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting export profile:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}

