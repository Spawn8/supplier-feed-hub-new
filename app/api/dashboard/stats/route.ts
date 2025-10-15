import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'

export async function GET() {
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

    // Get workspace info
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('name, created_at')
      .eq('id', workspaceId)
      .single()

    // Get supplier stats
    const { data: suppliers, error: suppliersError } = await supabase
      .from('suppliers')
      .select('id, status, last_sync_completed_at')
      .eq('workspace_id', workspaceId)

    if (suppliersError) {
      console.error('Error fetching suppliers:', suppliersError)
    }

    // Get product stats
    const { data: products, error: productsError } = await supabase
      .from('products_final')
      .select('id')
      .eq('workspace_id', workspaceId)

    if (productsError) {
      console.error('Error fetching products:', productsError)
    }

    // Get export stats
    const { data: exports, error: exportsError } = await supabase
      .from('export_history')
      .select('id')
      .eq('workspace_id', workspaceId)

    if (exportsError) {
      console.error('Error fetching exports:', exportsError)
    }

    // Total workspaces for this user (via membership)
    const { count: workspacesCount } = await supabase
      .from('workspace_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)

    // Get recent activity
    const { data: activities, error: activitiesError } = await supabase
      .from('activity_logs')
      .select('id, action, resource_type, resource_id, details, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(10)

    if (activitiesError) {
      console.error('Error fetching activities:', activitiesError)
    }

    // Calculate stats
    const totalSuppliers = suppliers?.length || 0
    const activeSuppliers = suppliers?.filter(s => (s as any).status === 'active').length || 0
    const errorSuppliers = suppliers?.filter(s => (s as any).status === 'error').length || 0
    const draftSuppliers = suppliers?.filter(s => (s as any).status === 'draft').length || 0
    const pausedSuppliers = suppliers?.filter(s => (s as any).status === 'paused').length || 0
    const totalProducts = products?.length || 0
    const totalExports = exports?.length || 0
    
    // Get last sync time
    const lastSyncAt = suppliers?.reduce((latest, supplier) => {
      const ts = (supplier as any).last_sync_completed_at as string | null
      if (ts && (!latest || new Date(ts) > new Date(latest))) {
        return ts
      }
      return latest
    }, null as string | null)

    // Format recent activity
    const recentActivity = activities?.map(activity => ({
      id: activity.id,
      action: activity.action,
      resource_type: activity.resource_type,
      resource_name: activity.details?.name || activity.details?.title || 'Unknown',
      created_at: activity.created_at
    })) || []

    const stats = {
      total_suppliers: totalSuppliers,
      total_products: totalProducts,
      total_exports: totalExports,
      last_sync_at: lastSyncAt,
      active_suppliers: activeSuppliers,
      error_suppliers: errorSuppliers,
      draft_suppliers: draftSuppliers,
      paused_suppliers: pausedSuppliers,
      total_workspaces: workspacesCount || 0,
      recent_activity: recentActivity
    }

    return NextResponse.json({ stats })
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}