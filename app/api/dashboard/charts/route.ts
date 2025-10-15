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

    // Get products over time (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: productsOverTime, error: productsError } = await supabase
      .from('products_mapped')
      .select('imported_at')
      .eq('workspace_id', workspaceId)
      .gte('imported_at', thirtyDaysAgo.toISOString())
      .order('imported_at', { ascending: true })

    if (productsError) {
      console.error('Error fetching products over time:', productsError)
    }

    // Get supplier performance data
    const { data: suppliers, error: suppliersError } = await supabase
      .from('suppliers')
      .select('id, name, status, last_sync_completed_at')
      .eq('workspace_id', workspaceId)

    if (suppliersError) {
      console.error('Error fetching suppliers:', suppliersError)
    }

    // Process products over time data
    const productsOverTimeData = {
      labels: [],
      datasets: [{
        label: 'Products Added',
        data: [],
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderColor: 'rgba(59, 130, 246, 1)'
      }]
    }

    // Group products by day
    if (productsOverTime && productsOverTime.length > 0) {
      const dailyCounts: Record<string, number> = {}
      
      productsOverTime.forEach(product => {
        const ts = (product as any).imported_at as string
        const date = new Date(ts).toISOString().split('T')[0]
        dailyCounts[date] = (dailyCounts[date] || 0) + 1
      })

      // Fill in last 7 days
      const last7Days = []
      for (let i = 6; i >= 0; i--) {
        const date = new Date()
        date.setDate(date.getDate() - i)
        const dateStr = date.toISOString().split('T')[0]
        last7Days.push(dateStr)
      }

      productsOverTimeData.labels = last7Days.map(date => {
        const d = new Date(date)
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      })
      
      productsOverTimeData.datasets[0].data = last7Days.map(date => dailyCounts[date] || 0)
    }

    // Process supplier performance data
    const supplierPerformanceData = {
      labels: [] as string[],
      datasets: [{
        label: 'Products per Supplier',
        data: [] as number[],
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(168, 85, 247, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(239, 68, 68, 0.8)',
          'rgba(14, 165, 233, 0.8)'
        ]
      }]
    }

    // Get product counts per supplier
    if (suppliers && suppliers.length > 0) {
      const counts = await Promise.all(
        suppliers.map(async (supplier) => {
          const { count } = await supabase
            .from('products_mapped')
            .select('*', { count: 'exact', head: true })
            .eq('workspace_id', workspaceId)
            .eq('supplier_id', supplier.id)
          return { id: supplier.id, name: supplier.name, count: count || 0 }
        })
      )

      // Sort desc and keep top 6
      counts.sort((a, b) => b.count - a.count)
      const top = counts.slice(0, 5)
      supplierPerformanceData.labels = top.map((t) => t.name)
      supplierPerformanceData.datasets[0].data = top.map((t) => t.count)
    }

    return NextResponse.json({
      products_over_time: productsOverTimeData,
      supplier_performance: supplierPerformanceData
    })
  } catch (error: any) {
    console.error('Error fetching dashboard charts:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}