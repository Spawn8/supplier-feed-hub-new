/**
 * Enhanced Ingest System with Global UIDs
 * 
 * This module provides ingestion functions that use the global UID system
 * to ensure all product UIDs are globally unique and never reusable.
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Readable } from 'stream'
import { parse } from 'csv-parse'
import { XMLParser } from 'fast-xml-parser'
import { 
  allocateBatchUids, 
  batchInsertWithGlobalUids,
  generateFallbackUid 
} from './globalUidSystem'

export interface IngestStats {
  total: number
  ok: number
  errors: number
  skipped: number
}

export interface IngestOptions {
  stream: Readable
  supabase: SupabaseClient
  workspace_id: string
  supplier_id: string
  ingestion_id: string
  uid_source_key?: string | null // Optional: if not provided, will generate UIDs
  source_file?: string
}

/**
 * Normalize a product item for consistent processing
 */
function normalizeItem(item: any): any {
  return {
    ean: item.ean || item.EAN || item.ean_code || null,
    sku: item.sku || item.SKU || item.product_sku || null,
    title: item.title || item.name || item.product_name || item.product_title || null,
    description: item.description || item.desc || item.product_description || null,
    price: parseFloat(item.price || item.PRICE || item.product_price || '0') || null,
    currency: item.currency || item.CURRENCY || item.currency_code || 'USD',
    quantity: parseInt(item.quantity || item.QUANTITY || item.stock || item.inventory || '0') || 0,
    category: item.category || item.CATEGORY || item.product_category || null,
    brand: item.brand || item.BRAND || item.manufacturer || null,
    image_url: item.image_url || item.image || item.product_image || item.photo || null,
    raw: item
  }
}

/**
 * Enhanced CSV ingestion with global UIDs
 */
export async function ingestCSVWithGlobalUids(opts: IngestOptions): Promise<IngestStats> {
  const { stream, supabase, workspace_id, supplier_id, ingestion_id, uid_source_key, source_file } = opts
  
  const stats: IngestStats = { total: 0, ok: 0, errors: 0, skipped: 0 }
  const BATCH_SIZE = 100
  let batch: Array<{ sourceUid?: string; normalized: any }> = []
  
  const parser = parse({
    columns: true,
    skip_empty_lines: true,
    trim: true
  })

  return new Promise<IngestStats>((resolve, reject) => {
    parser.on('readable', async () => {
      let row
      while ((row = parser.read()) !== null) {
        stats.total++
        try {
          const normalized = normalizeItem(row)
          
          // Determine UID source
          let sourceUid: string | undefined
          
          if (uid_source_key) {
            // Use specified UID source field
            const uidKeyLower = uid_source_key.toLowerCase()
            const flatRaw = Object.fromEntries(
              Object.entries(row ?? {}).map(([k, v]) => [k.toLowerCase(), v])
            )
            sourceUid = flatRaw[uidKeyLower]?.toString()
          } else {
            // Try common UID fields
            sourceUid = row.id || row.ID || row.product_id || row.PRODUCT_ID || 
                       row.sku || row.SKU || row.ean || row.EAN
          }

          // If no source UID found, we'll generate a fallback
          if (!sourceUid) {
            console.warn(`No UID found for product at index ${stats.total}, will generate fallback`)
          }

          batch.push({ sourceUid, normalized })
          
          if (batch.length >= BATCH_SIZE) {
            parser.pause()
            try {
              await processBatch()
              parser.resume()
            } catch (err) {
              reject(err)
              return
            }
          }
        } catch (err) {
          stats.errors++
          console.error(`Error processing row ${stats.total}:`, err)
        }
      }
    })

    parser.on('end', async () => {
      try {
        if (batch.length > 0) {
          await processBatch()
        }
        resolve(stats)
      } catch (err) {
        reject(err)
      }
    })

    parser.on('error', reject)

    // Process batch with global UIDs
    async function processBatch() {
      if (batch.length === 0) return

      try {
        const result = await batchInsertWithGlobalUids(supabase, batch, {
          workspace_id,
          supplier_id,
          ingestion_id,
          source_file
        })

        if (result.success) {
          stats.ok += batch.length
          console.log(`✅ Processed batch of ${batch.length} products with global UIDs`)
        } else {
          stats.errors += batch.length
          console.error(`❌ Failed to process batch: ${result.error}`)
        }
      } catch (err) {
        stats.errors += batch.length
        console.error('Exception processing batch:', err)
      }

      batch = []
    }

    // Start parsing
    stream.pipe(parser)
  })
}

/**
 * Enhanced JSON ingestion with global UIDs
 */
export async function ingestJSONWithGlobalUids(
  supabase: SupabaseClient,
  data: any[],
  context: {
    workspace_id: string
    supplier_id: string
    ingestion_id: string
    uid_source_key?: string | null
    source_file?: string
  }
): Promise<IngestStats> {
  const stats: IngestStats = { total: 0, ok: 0, errors: 0, skipped: 0 }
  const BATCH_SIZE = 100
  let batch: Array<{ sourceUid?: string; normalized: any }> = []

  for (let i = 0; i < data.length; i++) {
    stats.total++
    try {
      const item = data[i]
      const normalized = normalizeItem(item)
      
      // Determine UID source
      let sourceUid: string | undefined
      
      if (context.uid_source_key) {
        // Case-insensitive UID field lookup
        const uidKeyLower = context.uid_source_key.toLowerCase()
        const flatRaw = Object.fromEntries(
          Object.entries(item ?? {}).map(([k, v]) => [k.toLowerCase(), v])
        )
        sourceUid = flatRaw[uidKeyLower]?.toString()
      } else {
        sourceUid = item.id || item.product_id || item.sku || item.ean
      }

      if (!sourceUid) {
        console.warn(`No UID found for product at index ${i}, will generate fallback`)
      }

      batch.push({ sourceUid, normalized })
      
      if (batch.length >= BATCH_SIZE) {
        await processBatch()
      }
    } catch (err) {
      stats.errors++
      console.error(`Error processing item ${i}:`, err)
    }
  }

  // Process remaining batch
  if (batch.length > 0) {
    await processBatch()
  }

  async function processBatch() {
    if (batch.length === 0) return

    try {
      const result = await batchInsertWithGlobalUids(supabase, batch, context)

      if (result.success) {
        stats.ok += batch.length
        console.log(`✅ Processed batch of ${batch.length} products with global UIDs`)
      } else {
        stats.errors += batch.length
        console.error(`❌ Failed to process batch: ${result.error}`)
      }
    } catch (err) {
      stats.errors += batch.length
      console.error('Exception processing batch:', err)
    }

    batch = []
  }

  return stats
}

/**
 * Enhanced XML ingestion with global UIDs
 */
export async function ingestXMLWithGlobalUids(
  supabase: SupabaseClient,
  xmlString: string,
  context: {
    workspace_id: string
    supplier_id: string
    ingestion_id: string
    uid_source_key?: string | null
    source_file?: string
  }
): Promise<IngestStats> {
  // Parse XML string to object
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' })
  let doc: any
  
  try {
    doc = parser.parse(xmlString)
  } catch (e) {
    console.error('Failed to parse XML:', e)
    return { total: 0, ok: 0, errors: 1, skipped: 0 }
  }
  
  // Extract products from parsed XML
  const products = extractProductsFromXML(doc)
  
  if (products.length === 0) {
    console.warn('No products found in XML')
    return { total: 0, ok: 0, errors: 0, skipped: 0 }
  }
  
  console.log(`✅ Extracted ${products.length} products from XML`)
  return ingestJSONWithGlobalUids(supabase, products, context)
}

/**
 * Extract products from parsed XML data
 */
function extractProductsFromXML(doc: any): any[] {
  // If already an array, return it
  if (Array.isArray(doc)) {
    return doc
  }
  
  // Try common XML product feed paths
  const candidates = [
    ['products', 'product'],
    ['productfeed', 'product'],
    ['rss', 'channel', 'item'],
    ['items', 'item'],
    ['catalog', 'product'],
    ['channel', 'item'],
    ['PRODUCTS', 'PRODUCT'],
    ['CATALOG', 'PRODUCT'],
  ]
  
  for (const path of candidates) {
    let cur: any = doc
    let ok = true
    for (const p of path) {
      cur = cur?.[p]
      if (cur === undefined) {
        ok = false
        break
      }
    }
    if (ok) {
      // Found products at this path
      const items = Array.isArray(cur) ? cur : [cur]
      console.log(`✅ Found ${items.length} products at path: ${path.join(' > ')}`)
      return items
    }
  }
  
  // Fallback: find first array in the document
  function findFirstArray(obj: any): any[] | null {
    if (!obj || typeof obj !== 'object') return null
    for (const v of Object.values(obj)) {
      if (Array.isArray(v)) return v as any[]
      if (v && typeof v === 'object') {
        const found = findFirstArray(v)
        if (found) return found
      }
    }
    return null
  }
  
  const fallbackArray = findFirstArray(doc)
  if (fallbackArray && fallbackArray.length > 0) {
    console.log(`✅ Found ${fallbackArray.length} products via fallback search`)
    return fallbackArray
  }
  
  console.warn('No products array found in XML document')
  return []
}

/**
 * Migration function to convert existing products to global UID system
 */
export async function migrateProductsToGlobalUids(
  supabase: SupabaseClient,
  workspaceId: string,
  supplierId: string
): Promise<{ success: boolean; migrated: number; error?: string }> {
  try {
    // Get all existing products for this supplier
    const { data: existingProducts, error: fetchError } = await supabase
      .from('products_raw')
      .select('id, uid, workspace_id, supplier_id')
      .eq('workspace_id', workspaceId)
      .eq('supplier_id', supplierId)

    if (fetchError) {
      return { success: false, error: fetchError.message }
    }

    if (!existingProducts || existingProducts.length === 0) {
      return { success: true, migrated: 0 }
    }

    // Allocate new global UIDs for all existing products
    const uidResult = await allocateBatchUids(
      supabase,
      workspaceId,
      supplierId,
      existingProducts.length
    )

    if (!uidResult.success || !uidResult.uids) {
      return { success: false, error: uidResult.error || 'Failed to allocate UIDs' }
    }

    // Update products with new global UIDs
    let migrated = 0
    for (let i = 0; i < existingProducts.length; i++) {
      const product = existingProducts[i]
      const newUid = uidResult.uids![i].toString()

      // Update products_raw
      const { error: rawError } = await supabase
        .from('products_raw')
        .update({ uid: newUid })
        .eq('id', product.id)

      if (rawError) {
        console.error(`Failed to update products_raw for product ${product.id}:`, rawError)
        continue
      }

      // Update products_mapped
      const { error: mappedError } = await supabase
        .from('products_mapped')
        .update({ uid: newUid })
        .eq('workspace_id', workspaceId)
        .eq('supplier_id', supplierId)
        .eq('uid', product.uid)

      if (mappedError) {
        console.error(`Failed to update products_mapped for product ${product.id}:`, mappedError)
        continue
      }

      // Update products_final
      const { error: finalError } = await supabase
        .from('products_final')
        .update({ uid: newUid })
        .eq('workspace_id', workspaceId)
        .eq('uid', product.uid)

      if (finalError) {
        console.error(`Failed to update products_final for product ${product.id}:`, finalError)
        continue
      }

      migrated++
    }

    return { success: true, migrated }
  } catch (err) {
    console.error('Exception migrating products to global UIDs:', err)
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Unknown error' 
    }
  }
}
