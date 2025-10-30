import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'
import { getFieldMappings, saveFieldMappings } from '@/lib/fields'

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

    // Try to get workspace_id from query params first, then fallback to cookies
    const { searchParams } = new URL(req.url)
    let workspaceId = searchParams.get('workspace_id')
    
    if (!workspaceId) {
      workspaceId = await getCurrentWorkspaceId()
    }
    
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    const { id: supplierId } = await params

    // Get field mappings
    const mappings = await getFieldMappings(workspaceId, supplierId)

    return NextResponse.json({ mappings })
  } catch (error: any) {
    console.error('Error fetching field mappings:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}

export async function POST(
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

    const { id: supplierId } = await params
    const body = await req.json()
    const { mappings } = body

    if (!Array.isArray(mappings)) {
      return NextResponse.json({ 
        error: 'Mappings must be an array' 
      }, { status: 400 })
    }

    // Save field mappings
    const result = await saveFieldMappings(workspaceId, supplierId, mappings)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error saving field mappings:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}