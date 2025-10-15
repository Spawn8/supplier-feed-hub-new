import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'
import { getCustomFields } from '@/lib/fields'

export async function GET(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const workspaceId = searchParams.get('workspace_id')
    
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 })
    }

    // Get custom fields from database
    console.log('Fetching custom fields from database...')
    
    const { data: fields, error } = await supabase
      .from('custom_fields')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('Error fetching custom fields:', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.log('✅ Custom fields fetched successfully:', fields?.length || 0, 'fields')
    return NextResponse.json({ fields: fields || [] })
  } catch (error: any) {
    console.error('Error fetching custom fields:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}