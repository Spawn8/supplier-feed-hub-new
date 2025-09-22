// lib/ingest.ts
import { Readable } from 'stream'
import { parse as csvParse } from 'csv-parse'
import { parser as jsonParser } from 'stream-json'
import { streamArray } from 'stream-json/streamers/StreamArray'
import { chain } from 'stream-chain'
import { XMLParser } from 'fast-xml-parser'
import { SaxesParser } from 'saxes'
import type { SupabaseClient } from '@supabase/supabase-js'

type IngestStats = {
  total: number
  ok: number
  errors: number
}

export function detectFeedType(hint?: string, contentType?: string): 'csv'|'json'|'xml' {
  const h = (hint || '').toLowerCase()
  const ct = (contentType || '').toLowerCase()
  if (h.endsWith('.csv') || ct.includes('text/csv')) return 'csv'
  if (h.endsWith('.json') || ct.includes('application/json') || ct.includes('ndjson')) return 'json'
  if (h.endsWith('.xml') || ct.includes('application/xml') || ct.includes('text/xml')) return 'xml'
  // default: try JSON first
  return 'json'
}

function normString(v: any): string | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'string') return v.trim()
  return String(v)
}

function normNumber(v: any): number | null {
  if (v === null || v === undefined) return null
  const s = typeof v === 'string' ? v.replace(',', '.').replace(/[^\d.\-]/g, '') : String(v)
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

// Heuristic normalization from various feeds
function normalizeItem(item: any) {
  const flat = item && typeof item === 'object' ? item : {}
  const get = (...keys: string[]) => {
    for (const k of keys) {
      if (flat[k] !== undefined) return flat[k]
      // nested common cases
      const lower = Object.fromEntries(Object.entries(flat).map(([k,v]) => [k.toLowerCase(), v]))
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

  const external_id = sku || ean || normString(get('unique_id', 'uuid', 'id')) || null

  return {
    external_id,
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

async function batchInsert(
  supabase: SupabaseClient,
  rows: any[],
  workspace_id: string,
  supplier_id: string,
  ingestion_id: string,
  source_file?: string
) {
  if (!rows.length) return
  const payload = rows.map(r => ({
    workspace_id,
    supplier_id,
    ingestion_id,
    external_id: r.external_id,
    ean: r.ean,
    sku: r.sku,
    title: r.title,
    description: r.description,
    price: r.price,
    currency: r.currency,
    quantity: r.quantity,
    category: r.category,
    brand: r.brand,
    image_url: r.image_url,
    raw: r.raw,
    source_file: source_file || null
  }))
  // upsert on unique key (workspace_id, supplier_id, external_id)
  const { error } = await supabase
    .from('products_raw')
    .upsert(payload, {
      onConflict: 'workspace_id,supplier_id,external_id',
      ignoreDuplicates: false
    })
  if (error) throw error
}

/**
 * Stream CSV → normalized → batch upsert
 */
export async function ingestCSV(opts: {
  stream: Readable
  supabase: SupabaseClient
  workspace_id: string
  supplier_id: string
  ingestion_id: string
  source_file?: string
}) {
  const { stream, supabase, workspace_id, supplier_id, ingestion_id, source_file } = opts
  const parser = csvParse({ columns: true, relax_column_count: true, bom: true, skip_empty_lines: true })
  const stats: IngestStats = { total: 0, ok: 0, errors: 0 }
  const batch: any[] = []
  const BATCH_SIZE = 500

  return new Promise<IngestStats>((resolve, reject) => {
    parser.on('readable', async () => {
      let row
      while ((row = parser.read()) !== null) {
        stats.total++
        try {
          const normalized = normalizeItem(row)
          if (!normalized.external_id) throw new Error('Missing external_id (SKU/EAN/id)')
          batch.push(normalized)
          if (batch.length >= BATCH_SIZE) {
            parser.pause()
            batchInsert(supabase, batch.splice(0), workspace_id, supplier_id, ingestion_id, source_file)
              .then(() => parser.resume())
              .catch(reject)
          }
          stats.ok++
        } catch (e) {
          stats.errors++
          // store per-item error
          supabase.from('feed_errors').insert({
            ingestion_id, item_index: stats.total, message: (e as Error).message, raw: JSON.stringify(row).slice(0, 2000)
          })
        }
      }
    })
    parser.on('end', async () => {
      try {
        if (batch.length) await batchInsert(supabase, batch, workspace_id, supplier_id, ingestion_id, source_file)
        resolve(stats)
      } catch (e) {
        reject(e)
      }
    })
    parser.on('error', reject)
    stream.pipe(parser)
  })
}

/**
 * Stream JSON
 * - Supports large top-level arrays via StreamArray
 * - For NDJSON, the generic parser with streamArray will also work if lines are an array; if not, we can extend later
 */
export async function ingestJSON(opts: {
  stream: Readable
  supabase: SupabaseClient
  workspace_id: string
  supplier_id: string
  ingestion_id: string
  source_file?: string
}) {
  const { stream, supabase, workspace_id, supplier_id, ingestion_id, source_file } = opts
  const pipeline = chain([stream, jsonParser(), streamArray()])
  const stats: IngestStats = { total: 0, ok: 0, errors: 0 }
  const batch: any[] = []
  const BATCH_SIZE = 500

  return new Promise<IngestStats>((resolve, reject) => {
    pipeline.on('data', (data: any) => {
      const item = data?.value
      stats.total++
      try {
        const normalized = normalizeItem(item)
        if (!normalized.external_id) throw new Error('Missing external_id (SKU/EAN/id)')
        batch.push(normalized)
        if (batch.length >= BATCH_SIZE) {
          pipeline.pause()
          batchInsert(supabase, batch.splice(0), workspace_id, supplier_id, ingestion_id, source_file)
            .then(() => pipeline.resume())
            .catch(reject)
        }
        stats.ok++
      } catch (e) {
        stats.errors++
        supabase.from('feed_errors').insert({
          ingestion_id, item_index: stats.total, message: (e as Error).message, raw: JSON.stringify(item).slice(0, 2000)
        })
      }
    })
    pipeline.on('end', async () => {
      try {
        if (batch.length) await batchInsert(supabase, batch, workspace_id, supplier_id, ingestion_id, source_file)
        resolve(stats)
      } catch (e) {
        reject(e)
      }
    })
    pipeline.on('error', reject)
  })
}

/**
 * XML – initial implementation:
 * For now we buffer to string (suitable for moderate files).
 * We’ll replace with a streaming SAX pass next.
 */
export async function ingestXMLBuffer(opts: {
  stream: Readable
  supabase: SupabaseClient
  workspace_id: string
  supplier_id: string
  ingestion_id: string
  source_file?: string
}) {
  const { stream, supabase, workspace_id, supplier_id, ingestion_id, source_file } = opts
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  const xml = Buffer.concat(chunks).toString('utf-8')

  // Safety: limit 25MB for non-stream parser
  if (xml.length > 25 * 1024 * 1024) {
    await supabase.from('feed_ingestions').update({
      status: 'error',
      error_message: 'XML too large for non-stream parser; enable streaming XML'
    }).eq('id', ingestion_id)
    return { total: 0, ok: 0, errors: 1 }
  }

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' })
  const doc = parser.parse(xml)
  // Try common shapes: <products><product>...</product></products> OR <rss><channel><item>...</item></channel></rss>
  let items: any[] = []

  const candidates = [
    ['products', 'product'],
    ['productfeed', 'product'],
    ['rss', 'channel', 'item'],
    ['items', 'item'],
    ['catalog', 'product'],
  ]

  for (const path of candidates) {
    let cur: any = doc
    let ok = true
    for (const p of path) {
      cur = cur?.[p]
      if (cur === undefined) { ok = false; break }
    }
    if (ok) {
      items = Array.isArray(cur) ? cur : [cur]
      break
    }
  }

  if (!items.length) {
    // fallback: try to find first array in document
    const firstArray = findFirstArray(doc)
    items = firstArray || []
  }

  const stats: IngestStats = { total: 0, ok: 0, errors: 0 }
  const batch: any[] = []
  const BATCH_SIZE = 500

  for (const item of items) {
    stats.total++
    try {
      const normalized = normalizeItem(item)
      if (!normalized.external_id) throw new Error('Missing external_id (SKU/EAN/id)')
      batch.push(normalized)
      if (batch.length >= BATCH_SIZE) {
        await batchInsert(supabase, batch.splice(0), workspace_id, supplier_id, ingestion_id, source_file)
      }
      stats.ok++
    } catch (e) {
      stats.errors++
      await supabase.from('feed_errors').insert({
        ingestion_id, item_index: stats.total, message: (e as Error).message, raw: JSON.stringify(item).slice(0, 2000)
      })
    }
  }
  if (batch.length) await batchInsert(supabase, batch, workspace_id, supplier_id, ingestion_id, source_file)
  return stats
}

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
