import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getSupplier, storeSupplier } from '@/lib/memoryStore'

export async function POST(req: Request) {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { supplier_id, mappings, workspace_id } = await req.json()

    if (!supplier_id || !mappings) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    console.log('💾 Saving field mappings for supplier:', supplier_id)
    console.log('🗺️ Mappings:', mappings)
    console.log('👤 User ID:', user.id)

    // Skip database operations due to RLS issues
    // Store mappings in supplier's memory object instead
    console.log('Skipping database field_mappings insertion due to RLS issues')

    // Get supplier from memory first, then database
    let supplier = getSupplier(supplier_id)
    
    if (!supplier) {
      // Fallback to database
      const { data: dbSupplier, error: supplierError } = await supabase
        .from('suppliers')
        .select('workspace_id')
        .eq('id', supplier_id)
        .eq('created_by', user.id)
        .single()

      if (supplierError || !dbSupplier) {
        console.error('❌ Supplier not found in memory or database:', supplierError)
        return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
      }
      
      supplier = dbSupplier
      console.log('✅ Found supplier in database for field-mappings')
    } else {
      console.log('✅ Found supplier in memory for field-mappings')
    }

    console.log('🚀 Saving field mappings to database...')

    // Delete existing mappings for this supplier
    const { error: deleteError } = await supabase
      .from('field_mappings')
      .delete()
      .eq('supplier_id', supplier_id)

    if (deleteError) {
      console.error('❌ Error deleting existing field mappings:', deleteError)
      return NextResponse.json({ 
        error: `Failed to delete existing mappings: ${deleteError.message}` 
      }, { status: 500 })
    }

    console.log('✅ Deleted existing field mappings')

    // Insert new mappings
    if (mappings.length > 0) {
      // Filter out mappings with invalid custom_field_id (must be valid UUIDs)
      const validMappings = mappings.filter((mapping: any) => {
        const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mapping.custom_field_id)
        if (!isValidUUID) {
          console.warn(`Skipping mapping with invalid custom_field_id: ${mapping.custom_field_id}`)
        }
        return isValidUUID
      })

      if (validMappings.length === 0) {
        console.log('⚠️ No valid mappings to insert')
        return NextResponse.json({ 
          success: true,
          message: 'No valid mappings to save'
        })
      }

      // Translate custom_field_id (UUID) -> field key string (e.g., 'ean')
      const ids = Array.from(new Set(validMappings.map((m: any) => m.custom_field_id).filter(Boolean)))
      let idToKey: Record<string, string> = {}
      if (ids.length > 0) {
        const { data: cf, error: cfErr } = await supabase
          .from('custom_fields')
          .select('id,key')
          .in('id', ids)
          .eq('workspace_id', workspace_id)
        if (cfErr) {
          console.error('⚠️ Failed to load custom fields for mapping translation:', cfErr)
        } else {
          (cf || []).forEach((row: any) => { idToKey[row.id] = row.key })
        }
      }

      // Allow multiple custom fields to map to the same source field
      const mappingsToInsert = validMappings.map((mapping: any) => ({
        workspace_id: workspace_id,
        supplier_id: supplier_id,
        field_key: idToKey[mapping.custom_field_id] || mapping.custom_field_id,
        source_key: String(mapping.source_field || '').toLowerCase(),
        transform_type: 'direct',
        transform_config: {}
      }))

      console.log('💾 Mappings to insert:', mappingsToInsert)

      const { data: insertedMappings, error: insertError } = await supabase
        .from('field_mappings')
        .insert(mappingsToInsert)
        .select()

      if (insertError) {
        console.error('❌ Error inserting field mappings:', insertError)
        return NextResponse.json({ 
          error: `Failed to save field mappings: ${insertError.message}` 
        }, { status: 500 })
      }

      console.log('✅ Inserted', insertedMappings.length, 'field mappings')
    }

    console.log('✅ Field mappings saved successfully')

    return NextResponse.json({ 
      success: true,
      message: 'Field mappings saved successfully'
    })
  } catch (error: any) {
    console.error('Error in field mappings API:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}