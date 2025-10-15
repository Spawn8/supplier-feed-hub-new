import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getSupplier, getStoreSize } from '@/lib/memoryStore'

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    const { id: supplierId } = await params

    console.log('🔍 Mapped-data API called for supplier:', supplierId)
    console.log('📊 Memory store size:', getStoreSize())

    // Check memory first, then database for supplier
    let supplier = getSupplier(supplierId)
    
    if (supplier) {
      console.log('✅ Found supplier in memory for mapped-data')
    } else {
      console.log('❌ Supplier not found in memory, checking database...')
      // Fallback to database
      const { data: dbSupplier, error: supplierError } = await supabase
        .from('suppliers')
        .select('id, workspace_id, name')
        .eq('id', supplierId)
        .single()

      if (supplierError || !dbSupplier) {
        console.log('❌ Supplier not found in database either')
        return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
      }
      
      supplier = dbSupplier
      console.log('✅ Found supplier in database for mapped-data')
    }

    // Verify user has access to this workspace (skip for memory suppliers for now)
    if (!supplier.workspace_id) {
      console.log('⚠️ Supplier has no workspace_id, skipping access check')
    } else {
      const { data: membership } = await supabase
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', supplier.workspace_id)
        .eq('user_id', user.id)
        .single()

      if (!membership) {
        console.log('❌ Access denied to workspace:', supplier.workspace_id)
        return NextResponse.json({ error: 'Access denied' }, { status: 403 })
      }
    }

    // Get mapped products from database
    const { data: products, error: productsError } = await supabase
      .from('products_mapped')
      .select(`
        id,
        uid,
        fields,
        source_file,
        imported_at,
        ingestion_id
      `)
      .eq('supplier_id', supplierId)
      .order('imported_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (productsError) {
      console.error('Error fetching mapped products:', productsError)
      return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
    }

    // Get total count from database
    const { count, error: countError } = await supabase
      .from('products_mapped')
      .select('*', { count: 'exact', head: true })
      .eq('supplier_id', supplierId)

    if (countError) {
      console.error('Error counting products:', countError)
    }

    console.log(`✅ Got ${products?.length || 0} mapped products from database (${count || 0} total)`)

    // Get field mappings from database
    const { data: fieldMappings } = await supabase
      .from('field_mappings')
      .select(`
        source_key,
        field_key,
        transform_type,
        transform_config
      `)
      .eq('supplier_id', supplierId)
    
    console.log('✅ Got field mappings from database:', fieldMappings?.length || 0, 'mappings')
    console.log('🔧 Field mappings details:', fieldMappings)

    // Get custom fields for this workspace to show field names
    const { data: customFields } = await supabase
      .from('custom_fields')
      .select('id, name, key, datatype')
      .eq('workspace_id', supplier.workspace_id)

    // Create a map for easy lookup by both id and key
    const customFieldsMap = new Map()
    if (customFields) {
      customFields.forEach(field => {
        customFieldsMap.set(field.id, field)
        customFieldsMap.set(field.key, field) // Also map by key for field_key lookups
      })
    }
    
    console.log('📋 Custom fields:', customFields?.length || 0, 'fields')
    console.log('🔍 Custom fields details:', customFields)
    
    // Normalize field mappings to use field keys, not UUID ids
    const normalizedFieldMappings = (fieldMappings || []).map((m: any) => {
      const cf = customFieldsMap.get(m.field_key)
      const keyFromId = customFields?.find(f => f.id === m.field_key)?.key
      return {
        ...m,
        field_key: cf?.key || keyFromId || m.field_key,
      }
    })

    // Convert Map to object for JSON serialization
    const customFieldsObject = {}
    if (customFields) {
      customFields.forEach(field => {
        customFieldsObject[field.id] = field
        customFieldsObject[field.key] = field
      })
    }

    // Get latest ingestion info
    const { data: latestIngestion } = await supabase
      .from('feed_ingestions')
      .select('*')
      .eq('supplier_id', supplierId)
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    return NextResponse.json({
      products: products || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      },
      supplier: {
        id: supplier.id,
        name: supplier.name
      },
      fieldMappings: normalizedFieldMappings || [],
      customFields: customFieldsObject,
      latestIngestion: latestIngestion || null
    })

  } catch (error: any) {
    console.error('Error in mapped-data API:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}
