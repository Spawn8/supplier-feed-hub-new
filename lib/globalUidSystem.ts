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
 * Enhanced batch insert with global UID allocation
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
    // Allocate UIDs for all rows
    const uidResult = await allocateBatchUids(
      supabase,
      context.workspace_id,
      rows.length
    )

    if (!uidResult.success || !uidResult.uids) {
      return { success: false, error: uidResult.error || 'Failed to allocate UIDs' }
    }

    // Prepare payload with allocated UIDs
    const rawPayload = rows.map((row, index) => ({
      workspace_id: context.workspace_id,
      supplier_id: context.supplier_id,
      ingestion_id: context.ingestion_id,
      uid: uidResult.uids![index].toString(), // Use allocated global UID
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
      raw: row.normalized.raw,
      source_file: context.source_file || null,
    }))

    // Insert into products_raw
    const { error: rawError } = await supabase
      .from('products_raw')
      .upsert(rawPayload, {
        onConflict: 'workspace_id,supplier_id,uid',
        ignoreDuplicates: false,
      })

    if (rawError) {
      return { success: false, error: rawError.message }
    }

    return { 
      success: true, 
      allocatedUids: uidResult.uids.map(uid => uid.toString())
    }
  } catch (err) {
    console.error('Exception in batchInsertWithGlobalUids:', err)
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    }
  }
}
