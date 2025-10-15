import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const workspaceId = await getCurrentWorkspaceId()
    if (!workspaceId) return NextResponse.json({ error: 'No workspace selected' }, { status: 400 })

    // Import/Export queue (running/queued)
    const { data: runningIngest } = await supabase
      .from('feed_ingestions')
      .select('id, supplier_id, status, started_at, completed_at, items_processed, items_success, items_errors')
      .eq('workspace_id', workspaceId)
      .in('status', ['running'])
      .order('started_at', { ascending: false })

    const { data: queuedExports } = await supabase
      .from('export_history')
      .select('id, status, created_at, completed_at, profile_name')
      .eq('workspace_id', workspaceId)
      .in('status', ['running'])
      .order('created_at', { ascending: false })

    // Sync summary (last completed)
    const { data: lastIngestion } = await supabase
      .from('feed_ingestions')
      .select('id, status, started_at, completed_at, duration_ms, items_total, items_success, items_errors, error_message')
      .eq('workspace_id', workspaceId)
      .order('completed_at', { ascending: false })
      .limit(1)
      .single()

    // Top suppliers by products (simple count)
    const { data: suppliers } = await supabase
      .from('suppliers')
      .select('id, name, last_sync_completed_at')
      .eq('workspace_id', workspaceId)

    let topByProducts: Array<{ id: string, name: string, count: number }> = []
    if (suppliers && suppliers.length) {
      const counts = await Promise.all(suppliers.map(async (s) => {
        const { count } = await supabase
          .from('products_final')
          .select('*', { count: 'exact', head: true })
          .eq('workspace_id', workspaceId)
          .eq('winning_supplier_id', s.id)
        return { id: s.id, name: s.name, count: count || 0, last_sync_completed_at: s.last_sync_completed_at }
      }))
      counts.sort((a, b) => b.count - a.count)
      topByProducts = counts.slice(0, 5)
    }

    // Error summary - latest failed ingestions
    const { data: failedIngestions } = await supabase
      .from('feed_ingestions')
      .select('id, supplier_id, status, started_at, completed_at, error_message')
      .eq('workspace_id', workspaceId)
      .eq('status', 'failed')
      .order('completed_at', { ascending: false })
      .limit(5)

    // Workspace snapshot growth (basic): counts today vs 7 days ago
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const { count: suppliersNow } = await supabase
      .from('suppliers').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId)
    const { count: suppliersThen } = await supabase
      .from('suppliers').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).lt('creation_completed_at', sevenDaysAgo.toISOString())

    const { count: productsNow } = await supabase
      .from('products_final').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId)
    const { count: productsThen } = await supabase
      .from('products_final').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).lt('created_at', sevenDaysAgo.toISOString())

    const { count: exportsNow } = await supabase
      .from('export_history').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId)
    const { count: exportsThen } = await supabase
      .from('export_history').select('*', { count: 'exact', head: true }).eq('workspace_id', workspaceId).lt('created_at', sevenDaysAgo.toISOString())

    const snapshot = {
      suppliers: { now: suppliersNow || 0, then: suppliersThen || 0 },
      products: { now: productsNow || 0, then: productsThen || 0 },
      exports: { now: exportsNow || 0, then: exportsThen || 0 },
    }

    return NextResponse.json({
      queue: {
        imports: runningIngest || [],
        exports: queuedExports || [],
      },
      summary: lastIngestion || null,
      top_suppliers: topByProducts,
      errors: failedIngestions || [],
      snapshot,
    })
  } catch (error: any) {
    console.error('Error fetching dashboard insights:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}


