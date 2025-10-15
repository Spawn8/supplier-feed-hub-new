import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    console.log('Testing database connection...')
    console.log('User ID:', user.id)

    // Test 1: Check if we can query workspaces table
    const { data: workspaces, error: workspacesError } = await supabase
      .from('workspaces')
      .select('*')
      .limit(5)

    console.log('Workspaces query result:', { workspaces, workspacesError })

    // Test 2: Check if we can insert a test workspace
    const testWorkspace = {
      name: 'Test Workspace',
      slug: `test-${Date.now()}`,
      description: 'Test workspace for debugging',
      default_currency: 'USD',
      default_language: 'en',
      timezone: 'UTC',
      created_by: user.id
    }

    console.log('Attempting to insert test workspace...')
    const { data: insertedWorkspace, error: insertError } = await supabase
      .from('workspaces')
      .insert(testWorkspace)
      .select()
      .single()

    console.log('Insert result:', { insertedWorkspace, insertError })

    // Test 3: Check if we can query the inserted workspace
    if (insertedWorkspace) {
      const { data: retrievedWorkspace, error: retrieveError } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', insertedWorkspace.id)
        .single()

      console.log('Retrieve result:', { retrievedWorkspace, retrieveError })
    }

    return NextResponse.json({
      success: true,
      user: user.id,
      workspaces: workspaces || [],
      workspacesError,
      insertedWorkspace,
      insertError
    })
  } catch (error: any) {
    console.error('Database test error:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      details: error
    }, { status: 500 })
  }
}
