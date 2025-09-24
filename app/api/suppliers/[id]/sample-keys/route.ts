import { NextResponse } from 'next/server'
import { Readable } from 'stream'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { getCurrentWorkspaceId } from '@/lib/workspace'
import { detectFeedType } from '@/lib/ingest'

// Customize if your bucket name differs
const DEFAULT_BUCKET = process.env.NEXT_PUBLIC_SUPPLIER_UPLOADS_BUCKET || 'supplier-uploads'

// Read up to MAX_BYTES from a Readable into a Buffer
async function readHead(stream: Readable, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of stream) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    if (total + buf.length > maxBytes) {
      const slice = buf.subarray(0, Math.max(0, maxBytes - total))
      chunks.push(slice)
      total += slice.length
      break
    } else {
      chunks.push(buf)
      total += buf.length
    }
    if (total >= maxBytes) break
  }
  return Buffer.concat(chunks, total)
}

function unique<T>(arr: T[]): T[] {
  return Array.from(new Set(arr))
}

// --- CSV sniff ---
function detectDelimiter(sample: string): string {
  const candidates = [',', ';', '\t', '|']
  // choose the delimiter that yields the most columns on the first non-empty line
  const line = (sample.split(/\r?\n/).find(l => l.trim().length > 0) || '')
  let best = ',', bestCount = 0
  for (const d of candidates) {
    const parts = line.split(d)
    if (parts.length > bestCount) {
      bestCount = parts.length
      best = d
    }
  }
  return best
}
function sniffCSVKeys(sampleBuf: Buffer): string[] {
  const sample = sampleBuf.toString('utf8')
  const lines = sample.split(/\r?\n/).filter(l => l.trim().length > 0)
  if (lines.length === 0) return []
  const delim = detectDelimiter(sample)
  const header = lines[0].split(delim).map(h => h.trim().replace(/^"|"$/g, ''))
  return unique(header.filter(Boolean))
}

// --- JSON / NDJSON sniff ---
function firstObjectFromJSON(sampleStr: string): any | null {
  try {
    const json = JSON.parse(sampleStr)
    if (Array.isArray(json)) {
      return json.find((x: any) => x && typeof x === 'object') || null
    }
    // find first array-of-objects field if object
    if (json && typeof json === 'object') {
      for (const k of Object.keys(json)) {
        const v: any = (json as any)[k]
        if (Array.isArray(v)) {
          const obj = v.find((x: any) => x && typeof x === 'object')
          if (obj) return obj
        }
      }
      return json
    }
  } catch {
    // NDJSON: parse first non-empty line
    for (const line of sampleStr.split(/\r?\n/)) {
      const l = line.trim()
      if (!l) continue
      try {
        const obj = JSON.parse(l)
        if (obj && typeof obj === 'object') return obj
      } catch {}
    }
  }
  return null
}
function flattenKeys(obj: any, prefix = '', out: string[] = [], depth = 0): string[] {
  if (!obj || typeof obj !== 'object' || depth > 3) return out
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flattenKeys(v, key, out, depth + 1)
    } else {
      out.push(key)
    }
  }
  return out
}
function sniffJSONKeys(sampleBuf: Buffer): string[] {
  const sample = sampleBuf.toString('utf8')
  const obj = firstObjectFromJSON(sample)
  if (!obj) return []
  const keys = flattenKeys(obj)
  return unique(keys)
}

// --- XML sniff (no external deps): pick a repeated item tag, then list its child tags (1 level) ---
function sniffXMLKeys(sampleBuf: Buffer): string[] {
  const s = sampleBuf.toString('utf8')
  // strip XML declaration & comments to reduce noise
  const body = s.replace(/<\?xml[\s\S]*?\?>/gi, '').replace(/<!--([\s\S]*?)-->/g, '')
  // find candidate item tag names
  const tagRe = /<([A-Za-z_][\w:\-\.]*)\b[^>]*>/g
  const counts: Record<string, number> = {}
  let m: RegExpExecArray | null
  while ((m = tagRe.exec(body))) {
    const name = m[1]
    // skip obvious container names
    if (!name || /^(rss|channel|feed|items|products|root)$/i.test(name)) continue
    counts[name] = (counts[name] || 0) + 1
  }
  // prefer common item names
  const preferred = ['item', 'product', 'entry', 'offer', 'row']
  let best = preferred.find(n => counts[n] && counts[n] > 1)
  if (!best) {
    best = Object.entries(counts).sort((a, b) => (b[1] - a[1]))[0]?.[0]
  }
  if (!best) return []

  // extract first occurrence of that element's inner XML
  const firstOpen = new RegExp(`<${best}\\b[^>]*>`, 'i').exec(body)
  if (!firstOpen) return []
  const startIdx = firstOpen.index + firstOpen[0].length
  const closeRe = new RegExp(`</${best}>`, 'i')
  const close = closeRe.exec(body.slice(startIdx))
  const inner = close ? body.slice(startIdx, startIdx + close.index) : body.slice(startIdx)

  // list unique child tag names one level down
  const childRe = /<([A-Za-z_][\w:\-\.]*)\b[^>]*>/g
  const childSet = new Set<string>()
  while ((m = childRe.exec(inner))) {
    const nm = m[1]
    if (nm === best) continue
    // ignore nested containers that repeat; still include their name
    childSet.add(nm)
  }
  // also pick common attributes on the parent element, if any
  const attrMatch = new RegExp(`<${best}\\b([^>]*)>`, 'i').exec(firstOpen[0])
  if (attrMatch && attrMatch[1]) {
    const attrRe = /\b([A-Za-z_][\w:\-\.]*)="/g
    let am: RegExpExecArray | null
    while ((am = attrRe.exec(attrMatch[1]))) {
      childSet.add(`@${am[1]}`)
    }
  }

  return Array.from(childSet)
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = await createSupabaseServerClient()
  const wsId = await getCurrentWorkspaceId()
  if (!wsId) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

  const { data: s, error: sErr } = await supabase
    .from('suppliers')
    .select('id, workspace_id, source_type, endpoint_url, source_path, auth_username, auth_password')
    .eq('id', id)
    .single()
  if (sErr || !s) return NextResponse.json({ error: sErr?.message || 'Supplier not found' }, { status: 404 })

  // Prepare sample stream
  let stream: Readable
  let hint = ''
  let contentType = ''

  if (s.source_type === 'url') {
    if (!s.endpoint_url) return NextResponse.json({ error: 'endpoint_url is missing' }, { status: 400 })
    const headers: Record<string, string> = {}
    if (s.auth_username && s.auth_password) {
      headers.Authorization =
        'Basic ' + Buffer.from(`${s.auth_username}:${s.auth_password}`).toString('base64')
    }
    const resp = await fetch(s.endpoint_url, { headers })
    if (!resp.ok) {
      return NextResponse.json({ error: `Failed to fetch: ${resp.status} ${resp.statusText}` }, { status: 400 })
    }
    hint = s.endpoint_url
    contentType = resp.headers.get('content-type') || ''
    const ab = await resp.arrayBuffer()
    stream = Readable.from(Buffer.from(ab))
  } else if (s.source_type === 'upload') {
    if (!s.source_path) return NextResponse.json({ error: 'source_path is missing' }, { status: 400 })
    const { data, error } = await supabase.storage.from(DEFAULT_BUCKET).download(s.source_path)
    if (error) return NextResponse.json({ error: `Download failed: ${error.message}` }, { status: 400 })
    const ab = await data.arrayBuffer()
    stream = Readable.from(Buffer.from(ab))
    hint = s.source_path
  } else {
    return NextResponse.json({ error: `Unknown source_type: ${s.source_type}` }, { status: 400 })
  }

  const type = detectFeedType(hint, contentType)

  try {
    // Read at most 1MB for sniffing
    const head = await readHead(stream, 1_000_000)

    let keys: string[] = []
    if (type === 'csv') keys = sniffCSVKeys(head)
    else if (type === 'json') keys = sniffJSONKeys(head)
    else keys = sniffXMLKeys(head) // default xml

    // Cap to a reasonable number so UI stays fast
    keys = keys.slice(0, 200)

    if (!keys || keys.length === 0) {
      return NextResponse.json({ error: 'Could not extract keys from sample' }, { status: 400 })
    }
    return NextResponse.json({ type, keys })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to extract keys' }, { status: 400 })
  }
}
