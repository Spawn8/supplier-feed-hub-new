import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'

export async function GET(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const workspaceId = await getCurrentWorkspaceId()
    if (!workspaceId) return NextResponse.json({ error: 'No workspace selected' }, { status: 400 })

    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '25'), 100)
    const offset = (page - 1) * limit
    const q = (url.searchParams.get('q') || '').toLowerCase()
    const supplierId = url.searchParams.get('supplier_id') || undefined

    // Base query
    let query = supabase
      .from('products_mapped')
      .select('id, uid, fields, supplier_id, imported_at', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order('imported_at', { ascending: false })

    if (supplierId) query = query.eq('supplier_id', supplierId)

    // Fetch page
    const { data: rows, error, count } = await query.range(offset, offset + limit - 1)
    if (error) throw error

    // Supplier names map
    let suppliersMap: Record<string, string> = {}
    if (rows && rows.length) {
      const supplierIds = Array.from(new Set(rows.map(r => r.supplier_id)))
      const { data: suppliers } = await supabase
        .from('suppliers')
        .select('id, name')
        .in('id', supplierIds)
      suppliers?.forEach(s => { suppliersMap[s.id] = s.name })
    }

    // Get custom fields for this workspace
    const { data: customFields } = await supabase
      .from('custom_fields')
      .select('id, name, key, datatype, is_visible')
      .eq('workspace_id', workspaceId)
      .order('sort_order', { ascending: true })

    // Create a map for easy lookup
    const customFieldsMap = new Map()
    if (customFields) {
      customFields.forEach(field => {
        customFieldsMap.set(field.id, field)
        customFieldsMap.set(field.key, field)
      })
    }

    // Get field mappings for all suppliers in this workspace
    const { data: fieldMappings } = await supabase
      .from('field_mappings')
      .select('source_key, field_key, supplier_id')
      .eq('workspace_id', workspaceId)

    // Create a map of supplier field mappings
    const supplierFieldMappings: Record<string, Record<string, string>> = {}
    if (fieldMappings) {
      fieldMappings.forEach(mapping => {
        if (!supplierFieldMappings[mapping.supplier_id]) {
          supplierFieldMappings[mapping.supplier_id] = {}
        }
        supplierFieldMappings[mapping.supplier_id][mapping.source_key] = mapping.field_key
      })
    }

    // Lightweight search over common fields
    const filtered = (rows || []).filter(r => {
      if (!q) return true
      const f = r.fields || {}
      const hay = [f.title, f.name, f.sku, f.ean].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })

    const products = filtered.map(r => {
      const product: any = {
        id: r.id,
        uid: r.uid,
        name: r.fields?.title || r.fields?.name || '',
        ean: r.fields?.ean || '',
        price: r.fields?.price ?? null,
        supplier_id: r.supplier_id,
        supplier_name: suppliersMap[r.supplier_id] || '—',
        imported_at: r.imported_at,
        fields: r.fields || {}
      }

      // Add all custom field values to the product
      if (customFields) {
        customFields.forEach(field => {
          const fieldValue = r.fields?.[field.key]
          if (fieldValue !== undefined) {
            product[field.key] = fieldValue
          }
        })
      }

      return product
    })

    return NextResponse.json({
      products,
      customFields: customFields || [],
      pagination: {
        page,
        limit,
        total: count || products.length,
        totalPages: Math.ceil((count || products.length) / limit)
      }
    })
  } catch (e: any) {
    console.error('Error in /api/products:', e)
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 })
  }
}


