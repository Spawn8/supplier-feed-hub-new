import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'

export async function GET(req: Request) {
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

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    // Try to fetch activities, but handle potential RLS issues
    const { data: activities, error } = await supabase
      .from('activity_logs')
      .select(`
        id,
        action,
        resource_type,
        resource_id,
        details,
        created_at,
        user_id
      `)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error fetching activities:', error)
      // Return empty activities array as fallback due to RLS issues
      return NextResponse.json({ activities: [] })
    }

    const formattedActivities = activities?.map((activity: any) => ({
      id: activity.id,
      action: activity.action,
      resource_type: activity.resource_type,
      resource_name: activity.details?.name || activity.details?.title || 'Unknown',
      user_name: 'User', // Simplified since we can't join with auth.users due to RLS
      created_at: activity.created_at,
      details: activity.details
    })) || []

    return NextResponse.json({ activities: formattedActivities })
  } catch (error: any) {
    console.error('Error fetching activities:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}
