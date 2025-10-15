import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'
import { createExportProfile } from '@/lib/exports'

export async function POST(req: Request) {
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
      delivery_config
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

    // Create export profile
    const result = await createExportProfile(workspaceId, {
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
      delivery_config
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      profile: result.profile 
    })
  } catch (error: any) {
    console.error('Error creating export profile:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}
