import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'
import { getSupplier } from '@/lib/suppliers'
import { runDeduplication } from '@/lib/deduplication'

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
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

    const supplierId = params.id

    // Get supplier details
    const supplier = await getSupplier(supplierId)
    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    // Verify supplier belongs to current workspace
    if (supplier.workspace_id !== workspaceId) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Clear existing mapped products for this supplier
    await supabase
      .from('products_mapped')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('supplier_id', supplierId)

    // Clear existing final products
    await supabase
      .from('products_final')
      .delete()
      .eq('workspace_id', workspaceId)

    // Re-process raw products with current field mappings
    const { data: rawProducts } = await supabase
      .from('products_raw')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('supplier_id', supplierId)

    if (rawProducts && rawProducts.length > 0) {
      // This would need to be implemented to re-apply field mappings
      // For now, we'll just run deduplication
      const result = await runDeduplication(workspaceId)

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }

      return NextResponse.json({ 
        success: true, 
        stats: result.stats,
        conflicts: result.conflicts
      })
    } else {
      return NextResponse.json({ 
        error: 'No raw products found for this supplier' 
      }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Error remapping supplier data:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}