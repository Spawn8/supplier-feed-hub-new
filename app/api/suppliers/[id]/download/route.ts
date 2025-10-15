import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createSupabaseServerClient()
    
    // Get user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // First check if user has access to any workspace
    const { data: memberships, error: membershipError } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)

    console.log('🔍 Download - User ID:', user.id)
    console.log('🔍 Download - Memberships:', memberships)
    console.log('🔍 Download - Membership Error:', membershipError)

    if (membershipError) {
      console.error('Error checking memberships:', membershipError)
      return NextResponse.json({ error: 'Failed to check workspace access' }, { status: 500 })
    }

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ error: 'No workspace access' }, { status: 403 })
    }

    const workspaceIds = memberships.map(m => m.workspace_id)
    console.log('🔍 Download - Workspace IDs:', workspaceIds)

    // Get supplier with workspace membership check
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .select(`
        id,
        name,
        source_type,
        source_path,
        settings,
        workspace_id
      `)
      .eq('id', id)
      .in('workspace_id', workspaceIds)
      .single()

    console.log('🔍 Download - Supplier ID:', id)
    console.log('🔍 Download - Supplier:', supplier)
    console.log('🔍 Download - Supplier Error:', supplierError)

    if (supplierError || !supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    if (supplier.source_type !== 'upload' || !supplier.source_path) {
      return NextResponse.json({ error: 'No file to download' }, { status: 400 })
    }

    // Get file from private storage
    const { data: fileData, error: fileError } = await supabase.storage
      .from('feeds')
      .download(supplier.source_path)

    if (fileError || !fileData) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    // Get original filename from settings
    const originalFilename = supplier.settings?.original_filename || 
      supplier.source_path.split('/').pop() || 
      'download'

    // Convert blob to buffer
    const buffer = await fileData.arrayBuffer()

    // Return file with original name
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${originalFilename}"`,
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error: any) {
    console.error('Error downloading file:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}
