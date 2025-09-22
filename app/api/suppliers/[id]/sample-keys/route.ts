import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { detectFeedType } from '@/lib/ingest'
import { XMLParser } from 'fast-xml-parser'
import { Readable } from 'stream'

// Customize if your bucket name differs
const DEFAULT_BUCKET = process.env.NEXT_PUBLIC_SUPPLIER_UPLOADS_BUCKET || 'supplier-uploads'

// --------- utils ---------
function flattenKeys(obj: any, prefix = '', out: Set<string> = new Set()) {
  if (obj == null) return out
  if (Array.isArray(obj)) {
    // For arrays, scan a few elements to avoid explosion
    for (let i = 0; i < Math.min(obj.length, 5); i++) {
      flattenKeys(obj[i], prefix, out)
    }
    return out
  }
  if (typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      const next = prefix ? `${prefix}.${k}` : k
      // primitive → record this key
      if (v === null || typeof v !== 'object') {
        out.add(next)
      } else {
        flattenKeys(v, next, out)
      }
    }
    return out
  }
  // primitives at root
  if (prefix) out.add(prefix)
  return out
}

function uniqueSorted(arr: string[]) {
  return Array.from(new Set(arr)).sort((a, b) => a.localeCompare(b))
}

// Find an items array in parsed XML by common patterns
function findXmlItems(doc: any): any[] {
  const paths = [
    ['products', 'product'],
    ['productfeed', 'product'],
    ['rss', 'channel', 'item'],
    ['items', 'item'],
    ['catalog', 'product'],
    ['channel', 'item'],
  ]
  for (const path of paths) {
    let cur: any = doc
    let ok = true
    for (const p of path) {
      cur = cur?.[p]
      if (cur === undefined) { ok = false; break }
    }
    if (ok) return Array.isArray(cur) ? cur : [cur]
  }
  // fallback: breadth-first search for the first array of objects
  const q: any[] = [doc]
  while (q.length) {
    const n = q.shift()
    if (Array.isArray(n)) {
      const arr = n.filter((x) => x && typeof x === 'object')
      if (arr.length) return n
    } else if (n && typeof n === 'object') {
      for (const v of Object.values(n)) q.push(v)
    }
  }
  return []
}

// --------- route ---------
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // Load supplier
  const { data: s, error: sErr } = await supabase
    .from('suppliers')
    .select('id, workspace_id, source_type, endpoint_url, source_path, auth_username, auth_password')
    .eq('id', params.id)
    .single()
  if (sErr || !s) return NextResponse.json({ error: sErr?.message || 'Supplier not found' }, { status: 404 })

  // Build fetch URL (direct URL or signed storage URL)
  let url = ''
  if (s.source_type === 'url') {
    if (!s.endpoint_url) return NextResponse.json({ error: 'Missing endpoint_url' }, { status: 400 })
    url = s.endpoint_url
  } else {
    if (!s.source_path) return NextResponse.json({ error: 'Missing source_path' }, { status: 400 })
    const { data: sign, error: signErr } = await supabase
      .storage.from(DEFAULT_BUCKET)
      .createSignedUrl(s.source_path, 60 * 10)
    if (signErr || !sign?.signedUrl) return NextResponse.json({ error: signErr?.message || 'Cannot sign URL' }, { status: 400 })
    url = sign.signedUrl
  }

  const headers: Record<string, string> = {}
  if (s.auth_username && s.auth_password) {
    const token = Buffer.from(`${s.auth_username}:${s.auth_password}`).toString('base64')
    headers['Authorization'] = `Basic ${token}`
  }

  const res = await fetch(url, { headers })
  if (!res.ok || !res.body) return NextResponse.json({ error: `Fetch failed: ${res.status}` }, { status: 400 })

  const contentType = res.headers.get('content-type') || ''
  const type = detectFeedType(url, contentType)

  // Read up to ~2.5MB to keep it quick but cover many items/headers
  // @ts-ignore
  const nodeStream: Readable = Readable.fromWeb(res.body as any)
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of nodeStream) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    chunks.push(buf)
    size += buf.length
    if (size > 2.5 * 1024 * 1024) break
  }
  const sample = Buffer.concat(chunks).toString('utf-8')

  try {
    if (type === 'json') {
      let parsed: any
      try { parsed = JSON.parse(sample) } catch { parsed = null }
      if (!parsed) return NextResponse.json({ keys: [] })

      // accept top-level array or { items: [] } or { data: [] }
      let items: any[] = []
      if (Array.isArray(parsed)) items = parsed
      else if (Array.isArray(parsed?.items)) items = parsed.items
      else if (Array.isArray(parsed?.data)) items = parsed.data

      // If no clear array, try to find the first array of objects
      if (!items.length) {
        const q: any[] = [parsed]
        while (q.length) {
          const n = q.shift()
          if (Array.isArray(n)) {
            const arr = n.filter((x) => x && typeof x === 'object')
            if (arr.length) { items = n; break }
          } else if (n && typeof n === 'object') {
            for (const v of Object.values(n)) q.push(v)
          }
        }
      }

      // Scan first N items
      const bag = new Set<string>()
      const N = Math.min(items.length, 50)
      for (let i = 0; i < N; i++) {
        flattenKeys(items[i], '', bag)
      }
      return NextResponse.json({ keys: uniqueSorted(Array.from(bag)) })
    }

    if (type === 'csv') {
      // First non-empty line is header
      const headerLine = (sample.split(/\r?\n/).find((l) => l.trim().length) || '')
      const cols = headerLine
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      return NextResponse.json({ keys: uniqueSorted(cols) })
    }

    // XML
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      cdataPropName: '__cdata', // keep CDATA if present
      processEntities: true,
      trimValues: true,
    })
    const doc = parser.parse(sample)
    const items = findXmlItems(doc)
    const bag = new Set<string>()
    const N = Math.min(items.length, 50)
    for (let i = 0; i < N; i++) {
      flattenKeys(items[i], '', bag)
    }
    return NextResponse.json({ keys: uniqueSorted(Array.from(bag)) })
  } catch (e: any) {
    return NextResponse.json({ keys: [] })
  }
}
