import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { logActivity } from '@/lib/auth'
import { workspaceStore } from '../workspaces/route'

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await req.json()
    const { name, description, default_currency, default_language, timezone, logo_url } = body

    // Validate required fields
    if (!name) {
      return NextResponse.json({ 
        error: 'Workspace name is required' 
      }, { status: 400 })
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

    // Create workspace in database
    console.log('Creating workspace in database...')
    
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .insert({
        name,
        slug: `${slug}-${Date.now()}`,
        description,
        default_currency: default_currency || 'USD',
        default_language: default_language || 'en',
        timezone: timezone || 'UTC',
        logo_url: logo_url || null,
        created_by: user.id
      })
      .select()
      .single()

    if (workspaceError) {
      console.error('Error creating workspace in database:', workspaceError)
      return NextResponse.json({ 
        error: `Database error: ${workspaceError.message}`,
        details: workspaceError
      }, { status: 400 })
    }

    console.log('✅ Workspace created successfully in database:', workspace.id)
    console.log('Workspace details:', JSON.stringify(workspace, null, 2))

    // Try to add user as workspace member
    try {
      await supabase
        .from('workspace_members')
        .insert({
          workspace_id: workspace.id,
          user_id: user.id,
          role: 'owner'
        })
      console.log('✅ Workspace member created successfully')
    } catch (memberError) {
      console.log('Could not create workspace member:', memberError)
    }

    // Try to log activity
    try {
      await logActivity(workspace.id, 'workspace_created', 'workspace', workspace.id, {
        name: workspace.name
      })
      console.log('✅ Activity logged successfully')
    } catch (activityError) {
      console.log('Could not log activity:', activityError)
    }

    return NextResponse.json({ 
      success: true, 
      workspace 
    })
  } catch (error: any) {
    console.error('Error creating workspace:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}