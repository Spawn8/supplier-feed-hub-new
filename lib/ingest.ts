// lib/ingest.ts
import { Readable } from 'stream'
import { parse as csvParse } from 'csv-parse'
import { parser as jsonParser } from 'stream-json'
import { streamArray } from 'stream-json/streamers/StreamArray'
import { chain } from 'stream-chain'
import { XMLParser } from 'fast-xml-parser'
import type { SupabaseClient } from '@supabase/supabase-js'

/** ========================================================================
 * Types & constants
 * ====================================================================== */

type IngestStats = {
  total: number
  ok: number
  errors: number
}

type FieldDef = { id: string; key: string; datatype: string }

const BATCH_SIZE = 500

/** ========================================================================
 * Small utils
 * ====================================================================== */

function safeLower(s: unknown): string {
  return typeof s === 'string' ? s.toLowerCase() : ''
}

function ensureUidKey(uid_source_key: unknown): string {
  const key = typeof uid_source_key === 'string' ? uid_source_key.trim() : ''
  if (!key) {
    throw new Error(
      'UID source key is missing. Set it in step 3 of the wizard (Unique Identifier) before importing.'
    )
  }
  return key
}

/** ========================================================================
 * Helpers: feed type detection & normalization
 * ====================================================================== */

export function detectFeedType(
  hint?: string,
  contentType?: string
): 'csv' | 'json' | 'xml' {
  const h = (hint || '').toLowerCase()
  const ct = (contentType || '').toLowerCase()
  if (h.endsWith('.csv') || ct.includes('text/csv')) return 'csv'
  if (h.endsWith('.json') || ct.includes('application/json') || ct.includes('ndjson')) return 'json'
  if (h.endsWith('.xml') || ct.includes('application/xml') || ct.includes('text/xml')) return 'xml'
  // default guess
  return 'json'
}

function normString(v: any): string | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'string') return v.trim()
  return String(v)
}

function normNumber(v: any): number | null {
  if (v === null || v === undefined) return null
  const s =
    typeof v === 'string'
      ? v.replace(',', '.').replace(/[^\d.\-]/g, '')
      : String(v)
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

// Heuristic normalization for common product attributes
function normalizeItem(item: any) {
  const flat = item && typeof item === 'object' ? item : {}

  // case-insensitive getter
  const get = (...keys: string[]) => {
    const lower = Object.fromEntries(
      Object.entries(flat).map(([k, v]) => [k.toLowerCase(), v])
    )
    for (const k of keys) {
      const lk = k.toLowerCase()
      if (lower[lk] !== undefined) return lower[lk]
    }
    return undefined
  }

  const ean = normString(get('ean', 'gtin', 'barcode'))
  const sku = normString(get('sku', 'id', 'code', 'product_id'))
  const title = normString(get('title', 'name'))
  const description = normString(get('description', 'desc', 'long_description'))
  const price = normNumber(get('price', 'amount', 'sale_price', 'regular_price'))
  const currency = normString(get('currency', 'curr'))
  const quantity = Number(get('quantity', 'qty', 'stock', 'inventory') ?? 0) || null
  const category = normString(get('category', 'cat', 'category_name'))
  const brand = normString(get('brand', 'manufacturer'))
  const image_url = normString(get('image', 'image_url', 'img', 'picture'))

  return {
    ean,
    sku,
    title,
    description,
    price,
    currency,
    quantity,
    category,
    brand,
    image_url,
    raw: item,
  }
}

/** ========================================================================
 * Helpers: field defs & datatype coercion
 * ====================================================================== */

async function loadFieldDefs(
  supabase: SupabaseClient,
  workspace_id: string
): Promise<FieldDef[]> {
  const { data, error } = await supabase
    .from('custom_fields')
    .select('id, key, datatype')
    .eq('workspace_id', workspace_id)
    .order('sort_order', { ascending: true })
  if (error) throw error
  return data || []
}

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

/** ========================================================================
 * Field mappings
 * ====================================================================== */

async function loadFieldMappings(
  supabase: SupabaseClient,
  workspace_id: string,
  supplier_id: string
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('field_mappings')
    .select('source_key, field_key')
    .eq('workspace_id', workspace_id)
    .eq('supplier_id', supplier_id)
  if (error) throw error
  const map = new Map<string, string>()
  for (const r of data || []) {
    const src = safeLower(r?.source_key)
    const dst = (r as any)?.field_key
    if (src && dst) map.set(src, String(dst))
  }
  return map
}

/** ========================================================================
 * Feed errors (with workspace/supplier context)
 * ====================================================================== */

async function logFeedError(
  supabase: SupabaseClient,
  params: {
    workspace_id: string
    supplier_id: string
    ingestion_id: string
    item_index?: number
    code?: string
    message: string
    raw?: any
  }
) {
  const { workspace_id, supplier_id, ingestion_id, item_index, code, message, raw } = params
  await supabase.from('feed_errors').insert({
    workspace_id,
    supplier_id,
    ingestion_id,
    item_index: item_index ?? null,
    code: code ?? null,
    message,
    raw: raw ? JSON.stringify(raw).slice(0, 2000) : null,
  })
}

/** ========================================================================
 * Core: batch insert/upsert into products_raw AND products_mapped (by UID)
 * ====================================================================== */

async function batchInsertByUID(
  supabase: SupabaseClient,
  rows: Array<{ uid: string; normalized: any }>,
  ctx: {
    workspace_id: string
    supplier_id: string
    ingestion_id: string
    source_file?: string
    cachedFields?: FieldDef[] | null
    mappings?: Map<string, string> | null // source_key(lower) -> field_key
  }
) {
  if (!rows.length) return

  const { workspace_id, supplier_id, ingestion_id, source_file } = ctx

  // 1) Upsert into products_raw
  const rawPayload = rows.map(({ uid, normalized }) => ({
    workspace_id,
    supplier_id,
    ingestion_id,
    uid, // upsert key
    ean: normalized.ean,
    sku: normalized.sku,
    title: normalized.title,
    description: normalized.description,
    price: normalized.price,
    currency: normalized.currency,
    quantity: normalized.quantity,
    category: normalized.category,
    brand: normalized.brand,
    image_url: normalized.image_url,
    raw: normalized.raw,
    source_file: source_file || null,
  }))

  {
    const { error } = await supabase
      .from('products_raw')
      .upsert(rawPayload, {
        onConflict: 'workspace_id,supplier_id,uid',
        ignoreDuplicates: false,
      })
    if (error) throw error
  }

  // 2) Upsert into products_mapped
  const fieldDefs =
    ctx.cachedFields ?? (await loadFieldDefs(supabase, workspace_id))
  const fieldByKey = new Map(fieldDefs.map((f) => [f.key, f]))
  const mappings =
    ctx.mappings ?? (await loadFieldMappings(supabase, workspace_id, supplier_id))

  const mappedPayload = rows.map(({ uid, normalized }) => {
    const fields: Record<string, any> = {}

    // Candidates from normalized
    const normalizedFlat: Record<string, any> = {
      ean: normalized.ean,
      sku: normalized.sku,
      title: normalized.title,
      description: normalized.description,
      price: normalized.price,
      currency: normalized.currency,
      quantity: normalized.quantity,
      category: normalized.category,
      brand: normalized.brand,
      image_url: normalized.image_url,
    }

    // Flatten raw for lookup (lowercased keys)
    const flatRaw: Record<string, any> =
      normalized.raw && typeof normalized.raw === 'object'
        ? Object.fromEntries(
            Object.entries(normalized.raw).map(([k, v]) => [k.toLowerCase(), v])
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

  {
    const { error } = await supabase
      .from('products_mapped')
      .upsert(mappedPayload, {
        onConflict: 'workspace_id,supplier_id,uid',
        ignoreDuplicates: false,
      })
    if (error) throw error
  }
}

/** ========================================================================
 * CSV (streaming)
 * ====================================================================== */

export async function ingestCSV(opts: {
  stream: Readable
  supabase: SupabaseClient
  workspace_id: string
  supplier_id: string
  ingestion_id: string
  uid_source_key: string | null | undefined // required
  source_file?: string
}) {
  const {
    stream,
    supabase,
    workspace_id,
    supplier_id,
    ingestion_id,
    uid_source_key,
    source_file,
  } = opts

  const uidKey = ensureUidKey(uid_source_key)
  const uidKeyLower = uidKey.toLowerCase()

  const parser = csvParse({
    columns: true,
    relax_column_count: true,
    bom: true,
    skip_empty_lines: true,
  })

  const stats: IngestStats = { total: 0, ok: 0, errors: 0 }
  const batch: Array<{ uid: string; normalized: any }> = []
  const cachedFields = await loadFieldDefs(supabase, workspace_id)
  const mappings = await loadFieldMappings(supabase, workspace_id, supplier_id)

  return new Promise<IngestStats>((resolve, reject) => {
    parser.on('readable', async () => {
      let row
      while ((row = parser.read()) !== null) {
        stats.total++
        try {
          const normalized = normalizeItem(row)
          // compute UID from row using supplier's uid_source_key (case-insensitive)
          const flatRaw = Object.fromEntries(
            Object.entries(row ?? {}).map(([k, v]) => [safeLower(k), v])
          )
          const uid = flatRaw[uidKeyLower]
          if (!uid) {
            stats.errors++
            await logFeedError(supabase, {
              workspace_id,
              supplier_id,
              ingestion_id,
              item_index: stats.total,
              code: 'uid_missing',
              message: `UID key "${uidKey}" not found in record`,
              raw: row,
            })
            continue
          }

          batch.push({ uid: String(uid), normalized })
          if (batch.length >= BATCH_SIZE) {
            parser.pause()
            batchInsertByUID(
              supabase,
              batch.splice(0),
              { workspace_id, supplier_id, ingestion_id, source_file, cachedFields, mappings }
            )
              .then(() => parser.resume())
              .catch(reject)
          }
          stats.ok++
        } catch (e) {
          stats.errors++
          logFeedError(supabase, {
            workspace_id, supplier_id, ingestion_id,
            item_index: stats.total,
            message: (e as Error).message,
            raw: row,
          })
        }
      }
    })

    parser.on('end', async () => {
      try {
        if (batch.length)
          await batchInsertByUID(
            supabase,
            batch,
            { workspace_id, supplier_id, ingestion_id, source_file, cachedFields, mappings }
          )
        resolve(stats)
      } catch (e) {
        reject(e)
      }
    })

    parser.on('error', reject)
    stream.pipe(parser)
  })
}

/** ========================================================================
 * JSON (streaming top-level array)
 * ====================================================================== */

export async function ingestJSON(opts: {
  stream: Readable
  supabase: SupabaseClient
  workspace_id: string
  supplier_id: string
  ingestion_id: string
  uid_source_key: string | null | undefined // required
  source_file?: string
}) {
  const {
    stream,
    supabase,
    workspace_id,
    supplier_id,
    ingestion_id,
    uid_source_key,
    source_file,
  } = opts

  const uidKey = ensureUidKey(uid_source_key)
  const uidKeyLower = uidKey.toLowerCase()

  const pipeline = chain([stream, jsonParser(), streamArray()])
  const stats: IngestStats = { total: 0, ok: 0, errors: 0 }
  const batch: Array<{ uid: string; normalized: any }> = []
  const cachedFields = await loadFieldDefs(supabase, workspace_id)
  const mappings = await loadFieldMappings(supabase, workspace_id, supplier_id)

  return new Promise<IngestStats>((resolve, reject) => {
    pipeline.on('data', async (data: any) => {
      const item = data?.value
      stats.total++
      try {
        const normalized = normalizeItem(item)
        const flatRaw = Object.fromEntries(
          Object.entries(item ?? {}).map(([k, v]) => [safeLower(k), v])
        )
        const uid = flatRaw[uidKeyLower]
        if (!uid) {
          stats.errors++
          await logFeedError(supabase, {
            workspace_id,
            supplier_id,
            ingestion_id,
            item_index: stats.total,
            code: 'uid_missing',
            message: `UID key "${uidKey}" not found in record`,
            raw: item,
          })
          return
        }

        batch.push({ uid: String(uid), normalized })
        if (batch.length >= BATCH_SIZE) {
          ;(pipeline as any).pause?.()
          batchInsertByUID(
            supabase,
            batch.splice(0),
            { workspace_id, supplier_id, ingestion_id, source_file, cachedFields, mappings }
          )
            .then(() => (pipeline as any).resume?.())
            .catch(reject)
        }
        stats.ok++
      } catch (e) {
        stats.errors++
        logFeedError(supabase, {
          workspace_id, supplier_id, ingestion_id,
          item_index: stats.total,
          message: (e as Error).message,
          raw: item,
        })
      }
    })

    pipeline.on('end', async () => {
      try {
        if (batch.length)
          await batchInsertByUID(
            supabase,
            batch,
            { workspace_id, supplier_id, ingestion_id, source_file, cachedFields, mappings }
          )
        resolve(stats)
      } catch (e) {
        reject(e)
      }
    })

    pipeline.on('error', reject)
  })
}

/** ========================================================================
 * XML (buffering – good for moderate files; streaming can be added later)
 * ====================================================================== */

export async function ingestXMLBuffer(opts: {
  stream: Readable
  supabase: SupabaseClient
  workspace_id: string
  supplier_id: string
  ingestion_id: string
  uid_source_key: string | null | undefined // required
  source_file?: string
}) {
  const {
    stream,
    supabase,
    workspace_id,
    supplier_id,
    ingestion_id,
    uid_source_key,
    source_file,
  } = opts

  const uidKey = ensureUidKey(uid_source_key)
  const uidKeyLower = uidKey.toLowerCase()

  const chunks: Buffer[] = []
  for await (const chunk of stream)
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  const xml = Buffer.concat(chunks).toString('utf-8')

  // Safety limit for non-stream XML parsing (25MB)
  if (xml.length > 25 * 1024 * 1024) {
    await logFeedError(supabase, {
      workspace_id,
      supplier_id,
      ingestion_id,
      code: 'xml_too_large',
      message: 'XML too large for non-stream parser; enable streaming XML',
    })
    return { total: 0, ok: 0, errors: 1 }
  }

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' })
  let doc: any
  try {
    doc = parser.parse(xml)
  } catch (e) {
    await logFeedError(supabase, {
      workspace_id, supplier_id, ingestion_id,
      code: 'xml_parse_error',
      message: (e as Error).message || 'Failed to parse XML',
    })
    return { total: 0, ok: 0, errors: 1 }
  }

  // Try common paths
  let items: any[] = []
  const candidates = [
    ['products', 'product'],
    ['productfeed', 'product'],
    ['rss', 'channel', 'item'],
    ['items', 'item'],
    ['catalog', 'product'],
    ['channel', 'item'],
    ['PRODUCTS', 'PRODUCT'], // vendor variants
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
      items = Array.isArray(cur) ? cur : [cur]
      break
    }
  }

  if (!items.length) {
    // fallback: first array anywhere
    const firstArray = findFirstArray(doc)
    items = firstArray || []
  }

  const stats: IngestStats = { total: 0, ok: 0, errors: 0 }
  const batch: Array<{ uid: string; normalized: any }> = []
  const cachedFields = await loadFieldDefs(supabase, workspace_id)
  const mappings = await loadFieldMappings(supabase, workspace_id, supplier_id)

  for (const item of items) {
    stats.total++
    try {
      const normalized = normalizeItem(item)
      const flatRaw = Object.fromEntries(
        Object.entries(item ?? {}).map(([k, v]) => [safeLower(k), v])
      )
      const uid = flatRaw[uidKeyLower]
      if (!uid) {
        stats.errors++
        await logFeedError(supabase, {
          workspace_id,
          supplier_id,
          ingestion_id,
          item_index: stats.total,
          code: 'uid_missing',
          message: `UID key "${uidKey}" not found in record`,
          raw: item,
        })
        continue
      }

      batch.push({ uid: String(uid), normalized })
      if (batch.length >= BATCH_SIZE) {
        await batchInsertByUID(
          supabase,
          batch.splice(0),
          { workspace_id, supplier_id, ingestion_id, source_file, cachedFields, mappings }
        )
      }
      stats.ok++
    } catch (e) {
      stats.errors++
      await logFeedError(supabase, {
        workspace_id, supplier_id, ingestion_id,
        item_index: stats.total,
        message: (e as Error).message,
        raw: item,
      })
    }
  }

  if (batch.length)
    await batchInsertByUID(
      supabase,
      batch,
      { workspace_id, supplier_id, ingestion_id, source_file, cachedFields, mappings }
    )

  return stats
}

/** ========================================================================
 * Small util: find first array inside an object (XML fallback)
 * ====================================================================== */

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
