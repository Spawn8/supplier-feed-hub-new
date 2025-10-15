import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'

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

    const { id: workspaceId } = await params
    const body = await req.json()
    const { name, description, default_currency, default_language, timezone, logo_url } = body

    // Validate required fields
    if (!name) {
      return NextResponse.json({ 
        error: 'Workspace name is required' 
      }, { status: 400 })
    }

    // Update workspace in database
    console.log('Updating workspace in database...')
    
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .update({
        name,
        description,
        default_currency: default_currency || 'USD',
        default_language: default_language || 'en',
        timezone: timezone || 'UTC',
        logo_url: logo_url || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', workspaceId)
      .eq('created_by', user.id) // Ensure user owns the workspace
      .select()
      .single()

    if (workspaceError) {
      console.error('Error updating workspace in database:', workspaceError)
      return NextResponse.json({ 
        error: `Database error: ${workspaceError.message}`,
        details: workspaceError
      }, { status: 400 })
    }

    if (!workspace) {
      return NextResponse.json({ 
        error: 'Workspace not found or you do not have permission to edit it' 
      }, { status: 404 })
    }

    console.log('✅ Workspace updated successfully in database:', workspace.id)

    return NextResponse.json({ 
      success: true, 
      workspace 
    })
  } catch (error: any) {
    console.error('Error updating workspace:', error)
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

    const { id: workspaceId } = await params

    // Delete workspace from database
    console.log('Deleting workspace from database...')
    
    const { error: deleteError } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', workspaceId)
      .eq('created_by', user.id) // Ensure user owns the workspace

    if (deleteError) {
      console.error('Error deleting workspace from database:', deleteError)
      return NextResponse.json({ 
        error: `Database error: ${deleteError.message}`,
        details: deleteError
      }, { status: 400 })
    }

    console.log('✅ Workspace deleted successfully from database:', workspaceId)

    return NextResponse.json({ 
      success: true 
    })
  } catch (error: any) {
    console.error('Error deleting workspace:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}
