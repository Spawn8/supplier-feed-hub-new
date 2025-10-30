/**
 * Global UID System for Products
 * 
 * This module provides a globally unique, non-reusable UID system for products.
 * UIDs are:
 * - Globally unique across all workspaces, suppliers, and time
 * - Never reusable (once used, never used again)
 * - Monotonic (always increasing)
 * - Collision-resistant (safe for concurrent operations)
 */

import { SupabaseClient } from '@supabase/supabase-js'

export interface UidAllocationResult {
  success: boolean
  uid?: bigint
  uids?: bigint[]
  error?: string
}

export interface UidDetails {
  uid: bigint
  workspace_id: string
  supplier_id: string
  product_id?: string
  created_at: string
  is_active: boolean
}

/**
 * Allocate a single globally unique UID
 */
export async function allocateProductUid(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<UidAllocationResult> {
  try {
    const { data, error } = await supabase.rpc('allocate_product_uid', {
      p_workspace_id: workspaceId
    })

    if (error) {
      console.error('Error allocating UID:', error)
      return { success: false, error: error.message }
    }

    return { success: true, uid: BigInt(data) }
  } catch (err) {
    console.error('Exception allocating UID:', err)
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    }
  }
}

/**
 * Allocate multiple UIDs for bulk operations
 */
export async function allocateBatchUids(
  supabase: SupabaseClient,
  workspaceId: string,
  count: number
): Promise<UidAllocationResult> {
  try {
    const { data, error } = await supabase.rpc('allocate_batch_uids', {
      p_workspace_id: workspaceId,
      p_count: count
    })

    if (error) {
      console.error('Error allocating batch UIDs:', error)
      return { success: false, error: error.message }
    }

    const uids = data.map((uid: string) => BigInt(uid))
    return { success: true, uids }
  } catch (err) {
    console.error('Exception allocating batch UIDs:', err)
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    }
  }
}

/**
 * Check if a UID is valid and active
 */
export async function isUidValid(
  supabase: SupabaseClient,
  uid: bigint
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('is_uid_valid', {
      p_uid: uid.toString()
    })

    if (error) {
      console.error('Error checking UID validity:', error)
      return false
    }

    return Boolean(data)
  } catch (err) {
    console.error('Exception checking UID validity:', err)
    return false
  }
}

/**
 * Get detailed information about a UID
 */
export async function getUidDetails(
  supabase: SupabaseClient,
  uid: bigint
): Promise<UidDetails | null> {
  try {
    const { data, error } = await supabase.rpc('get_uid_details', {
      p_uid: uid.toString()
    })

    if (error) {
      console.error('Error getting UID details:', error)
      return null
    }

    if (!data || data.length === 0) {
      return null
    }

    const details = data[0]
    return {
      uid: BigInt(details.uid),
      workspace_id: details.workspace_id,
      supplier_id: details.supplier_id,
      product_id: details.product_id,
      created_at: details.created_at,
      is_active: details.is_active
    }
  } catch (err) {
    console.error('Exception getting UID details:', err)
    return null
  }
}

/**
 * Deactivate a UID (soft delete - UID is never reused)
 */
export async function deactivateUid(
  supabase: SupabaseClient,
  uid: bigint
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('deactivate_uid', {
      p_uid: uid.toString()
    })

    if (error) {
      console.error('Error deactivating UID:', error)
      return false
    }

    return Boolean(data)
  } catch (err) {
    console.error('Exception deactivating UID:', err)
    return false
  }
}

/**
 * Migrate existing products to the new UID system
 */
export async function migrateExistingProducts(
  supabase: SupabaseClient
): Promise<{ success: boolean; results?: any[]; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('migrate_existing_products')

    if (error) {
      console.error('Error migrating existing products:', error)
      return { success: false, error: error.message }
    }

    return { success: true, results: data }
  } catch (err) {
    console.error('Exception migrating existing products:', err)
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    }
  }
}

/**
 * Generate a fallback UID for products that don't have a source UID
 * This should only be used when the source data doesn't provide unique identifiers
 */
export async function generateFallbackUid(
  supabase: SupabaseClient,
  workspaceId: string,
  supplierId: string,
  productIndex: number
): Promise<string> {
  // For fallback UIDs, we'll use a combination of supplier ID and index
  // This ensures uniqueness within the supplier but not globally
  // The new UID system will handle global uniqueness
  const fallbackUid = `fallback_${supplierId}_${productIndex}`
  
  // Allocate a real global UID for this fallback
  const result = await allocateProductUid(supabase, workspaceId)
  
  if (result.success && result.uid) {
    return result.uid.toString()
  }
  
  // If allocation fails, return the fallback (not ideal but functional)
  return fallbackUid
}

/**
 * Helper to load field definitions
 */
async function loadFieldDefs(
  supabase: SupabaseClient,
  workspace_id: string
): Promise<Array<{ id: string; key: string; datatype: string }>> {
  const { data, error } = await supabase
    .from('custom_fields')
    .select('id, key, datatype')
    .eq('workspace_id', workspace_id)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data || []
}

/**
 * Helper to load field mappings
 */
async function loadFieldMappings(
  supabase: SupabaseClient,
  workspace_id: string,
  supplier_id: string
): Promise<Map<string, string[]>> {
  const { data, error } = await supabase
    .from('field_mappings')
    .select('source_key, field_key')
    .eq('workspace_id', workspace_id)
    .eq('supplier_id', supplier_id)
  if (error) throw error
  const map = new Map<string, string[]>()
  for (const r of data || []) {
    const src = String((r as any)?.source_key || '').toLowerCase()
    const dst = String((r as any)?.field_key || '')
    if (!src || !dst) continue
    const arr = map.get(src) || []
    arr.push(dst)
    map.set(src, arr)
  }
  return map
}

/**
 * Helper to coerce datatypes
 */
function coerceDatatype(value: any, dt: string) {
  if (value == null) return null
  try {
    switch (dt) {
      case 'number': {
        const n = Number(
          typeof value === 'string'
            ? value.replace(',', '.').replace(/[^\d.\-]/g, '')
            : value
        )
        return Number.isFinite(n) ? n : null
      }
      case 'bool': {
        if (typeof value === 'boolean') return value
        const s = String(value).toLowerCase().trim()
        if (['1', 'true', 'yes', 'y'].includes(s)) return true
        if (['0', 'false', 'no', 'n'].includes(s)) return false
        return null
      }
      case 'date': {
        const d = new Date(value)
        return isNaN(d as unknown as number) ? null : d.toISOString()
      }
      case 'json': {
        if (typeof value === 'object') return value
        return JSON.parse(String(value))
      }
      default:
        return String(value)
    }
  } catch {
    return null
  }
}

/**
 * Simplified batch insert - only stores in products_mapped with field mapping
 * No products_raw or products_final - single source of truth approach
 */
export async function batchInsertWithGlobalUids(
  supabase: SupabaseClient,
  rows: Array<{ 
    sourceUid?: string
    normalized: any 
  }>,
  context: {
    workspace_id: string
    supplier_id: string
    ingestion_id: string
    source_file?: string
  }
): Promise<{ success: boolean; error?: string; allocatedUids?: string[] }> {
  try {
    const { workspace_id, supplier_id, ingestion_id, source_file } = context
    
    // Load field definitions and mappings
    const fieldDefs = await loadFieldDefs(supabase, workspace_id)
    const fieldByKey = new Map(fieldDefs.map((f) => [f.key, f]))
    const mappings = await loadFieldMappings(supabase, workspace_id, supplier_id)

    // Create products_mapped directly with field mappings applied
    const mappedPayload = rows.map((row, index) => {
      // Use sourceUid if available, otherwise generate a unique ID
      const uid = row.sourceUid || `generated_${workspace_id}_${supplier_id}_${Date.now()}_${index}`
      
      const fields: Record<string, any> = {}
      
      // Normalized fields
      const normalizedFlat: Record<string, any> = {
        ean: row.normalized.ean,
        sku: row.normalized.sku,
        title: row.normalized.title,
        description: row.normalized.description,
        price: row.normalized.price,
        currency: row.normalized.currency,
        quantity: row.normalized.quantity,
        category: row.normalized.category,
        brand: row.normalized.brand,
        image_url: row.normalized.image_url,
      }

      // Flatten raw for lookup (lowercased keys)
      const flatRaw: Record<string, any> =
        row.normalized.raw && typeof row.normalized.raw === 'object'
          ? Object.fromEntries(
              Object.entries(row.normalized.raw).map(([k, v]) => [k.toLowerCase(), v])
            )
          : {}

      // 1) Apply explicit mappings
      for (const [srcLower, dstFieldKey] of mappings.entries()) {
        if (!srcLower) continue
        const def = fieldByKey.get(dstFieldKey)
        if (!def) continue
        const rawVal = flatRaw[srcLower]
        const normVal = (normalizedFlat as any)[srcLower]
        const chosen = normVal ?? rawVal
        fields[def.key] = coerceDatatype(chosen, def.datatype)
      }

      // 2) Fill remaining defined fields by best-effort
      for (const def of fieldDefs) {
        if (fields[def.key] !== undefined) continue
        const kLower = def.key.toLowerCase()
        let val = (normalizedFlat as any)[kLower]
        if (val == null) val = flatRaw[kLower]
        fields[def.key] = coerceDatatype(val, def.datatype)
      }

      return {
        workspace_id,
        supplier_id,
        ingestion_id,
        uid,
        fields,
        source_file: source_file || null,
      }
    })

    // Upsert into products_mapped - this is now the single source of truth
    const { error: mappedError } = await supabase
      .from('products_mapped')
      .upsert(mappedPayload, {
        onConflict: 'workspace_id,supplier_id,uid',
        ignoreDuplicates: false,
      })

    if (mappedError) {
      return { success: false, error: mappedError.message }
    }

    return { 
      success: true, 
      allocatedUids: rows.map(row => row.sourceUid || 'generated')
    }
  } catch (err) {
    console.error('Exception in batchInsertWithGlobalUids:', err)
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    }
  }
}
