import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Record when creation started
    const creationStartedAt = new Date().toISOString()

    // Check if request has file upload (FormData) or JSON
    const contentType = req.headers.get('content-type') || ''
    let body: any = {}
    let uploadedFile: File | null = null
    let uploaded_public_url: string | null = null
    let source_path: string | null = null
    let original_filename: string | null = null

    if (contentType.includes('multipart/form-data')) {
      // Handle file upload with FormData
      const formData = await req.formData()
      body = {
        workspace_id: formData.get('workspace_id'),
        name: formData.get('name'),
        description: formData.get('description'),
        source_type: formData.get('source_type'),
        endpoint_url: formData.get('endpoint_url'),
        auth_username: formData.get('auth_username'),
        auth_password: formData.get('auth_password'),
        schedule_cron: formData.get('schedule_cron'),
        schedule_enabled: formData.get('schedule_enabled') === 'true',
        settings: formData.get('settings')
      }
      uploadedFile = formData.get('file') as File | null
    } else {
      // Handle JSON request
      body = await req.json()
    }

    const {
      workspace_id,
      name,
      description,
      source_type,
      endpoint_url,
      auth_username,
      auth_password,
      schedule_cron,
      schedule_enabled,
      settings,
      uid
    } = body

    if (!workspace_id) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    // Validate required fields
    if (!name || !source_type) {
      return NextResponse.json({ 
        error: 'Name and source type are required' 
      }, { status: 400 })
    }

    if (source_type === 'url' && !endpoint_url) {
      return NextResponse.json({ 
        error: 'Endpoint URL is required for URL sources' 
      }, { status: 400 })
    }

    // Handle file upload if present
    if (source_type === 'upload' && uploadedFile) {
      const { randomUUID } = await import('crypto')
      const bytes = await uploadedFile.arrayBuffer()
      const buf = Buffer.from(bytes)
      original_filename = uploadedFile.name || null
      const ext =
        uploadedFile.type.includes('xml') ? 'xml' :
        uploadedFile.type.includes('csv') ? 'csv' :
        uploadedFile.type.includes('json') ? 'json' :
        'bin'
      const contentType =
        ext === 'xml' ? 'application/xml' :
        ext === 'csv' ? 'text/csv' :
        ext === 'json' ? 'application/json' :
        'application/octet-stream'

      const objectName = `${workspace_id}/${randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage.from('feeds').upload(objectName, buf, { contentType })
      if (upErr) {
        return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 })
      }
      source_path = objectName
      
      // Don't generate public URL - we'll use a secure download endpoint instead
      uploaded_public_url = null
    }

    console.log('🚀 Creating supplier in database...')
    console.log('👤 User ID:', user.id)
    console.log('🏢 Workspace ID:', workspace_id)

    // Allocate next supplier UID per workspace (starts at 1 and increments by 1)
    const { data: seqVal, error: seqErr } = await supabase.rpc('allocate_supplier_uid', {
      p_workspace_id: workspace_id
    })
    if (seqErr) {
      console.error('❌ UID allocation error:', seqErr)
      return NextResponse.json({ error: 'Failed to allocate UID' }, { status: 500 })
    }
    const finalUid = uid || String(seqVal)
    console.log('🔢 Final UID:', finalUid)

    // Debug: Check workspace membership
    const { data: membership, error: membershipError } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', workspace_id)
      .eq('user_id', user.id)
      .single()
    
    console.log('🔍 Membership check:', { membership, membershipError })

    // Create supplier directly in database
    const { data: supplier, error: supplierError } = await supabase
      .from('suppliers')
      .insert({
        workspace_id,
        name,
        description,
        source_type,
        endpoint_url: source_type === 'url' ? endpoint_url : uploaded_public_url,
        source_path,
        auth_username,
        auth_password,
        schedule_cron: schedule_cron || null,
        schedule_enabled: schedule_enabled || false,
        settings: { 
          ...(settings || {}), 
          ...(original_filename ? { original_filename } : {}),
          uid_source_key: settings?.uid_source_key || null
        },
        status: 'draft',
        last_sync_status: 'never',
        creation_started_at: creationStartedAt,
        created_by: user.id,
        uid: finalUid
      })
      .select()
      .single()

    if (supplierError) {
      console.error('❌ Error creating supplier:', supplierError)
      return NextResponse.json({ 
        error: `Failed to create supplier: ${supplierError.message}` 
      }, { status: 500 })
    }

    console.log('✅ Supplier created in database:', supplier.id)

    // Log activity
    try {
      await supabase
        .from('activity_logs')
        .insert({
          workspace_id,
          user_id: user.id,
          action: 'supplier_created',
          details: {
            supplier_id: supplier.id,
            supplier_name: supplier.name,
            source_type: supplier.source_type
          }
        })
      console.log('✅ Activity logged')
    } catch (activityError) {
      console.error('⚠️ Failed to log activity:', activityError)
      // Don't fail the request if activity logging fails
    }

    return NextResponse.json({ 
      success: true, 
      supplier 
    })
  } catch (error: any) {
    console.error('Error creating supplier:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}