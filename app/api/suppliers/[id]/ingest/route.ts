import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { detectFeedType, ingestCSV, ingestJSON, ingestXMLBuffer } from '@/lib/ingest'
import { Readable } from 'stream'

const DEFAULT_BUCKET = process.env.NEXT_PUBLIC_SUPPLIER_UPLOADS_BUCKET || 'supplier-uploads'

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createSupabaseServerClient()
  const { data: auth } = await supabase.auth.getUser()
  const user = auth?.user
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // Load supplier with workspace id
  const { data: supplier, error: sErr } = await supabase
    .from('suppliers')
    .select('id, workspace_id, name, source_type, endpoint_url, source_path, schedule, auth_username, auth_password')
    .eq('id', params.id)
    .single()
  if (sErr || !supplier) return NextResponse.json({ error: sErr?.message || 'Supplier not found' }, { status: 404 })

  // Create ingestion row
  const { data: ing, error: iErr } = await supabase
    .from('feed_ingestions')
    .insert({
      workspace_id: supplier.workspace_id,
      supplier_id: supplier.id,
      source_url: supplier.source_type === 'url' ? supplier.endpoint_url : supplier.source_path,
      status: 'pending'
    })
    .select('id')
    .single()
  if (iErr || !ing) return NextResponse.json({ error: iErr?.message || 'Could not start ingestion' }, { status: 400 })

  let stream: Readable | null = null
  let type: 'csv'|'json'|'xml' = 'json'
  let contentType = ''
  let sourceLabel = supplier.endpoint_url || supplier.source_path || ''

  try {
    if (supplier.source_type === 'url') {
      if (!supplier.endpoint_url) throw new Error('Missing endpoint_url')
      const headers: Record<string, string> = {}
      if (supplier.auth_username && supplier.auth_password) {
        const token = Buffer.from(`${supplier.auth_username}:${supplier.auth_password}`).toString('base64')
        headers['Authorization'] = `Basic ${token}`
      }
      const res = await fetch(supplier.endpoint_url, { headers })
      if (!res.ok || !res.body) throw new Error(`Fetch failed: ${res.status}`)
      contentType = res.headers.get('content-type') || ''
      type = detectFeedType(supplier.endpoint_url, contentType)
      // convert web stream to node stream
      // @ts-ignore
      stream = Readable.fromWeb(res.body as any)
    } else {
      // upload case: get a signed URL then fetch
      if (!supplier.source_path) throw new Error('Missing source_path')
      const { data: sign, error: signErr } = await supabase
        .storage
        .from(DEFAULT_BUCKET)
        .createSignedUrl(supplier.source_path, 60 * 30) // 30 min
      if (signErr || !sign?.signedUrl) throw new Error(signErr?.message || 'Cannot sign file URL')

      const res = await fetch(sign.signedUrl)
      if (!res.ok || !res.body) throw new Error(`Download failed: ${res.status}`)
      contentType = res.headers.get('content-type') || ''
      type = detectFeedType(supplier.source_path, contentType)
      // @ts-ignore
      stream = Readable.fromWeb(res.body as any)
    }

    if (!stream) throw new Error('No stream available')

    // Run parser
    let stats
    if (type === 'csv') {
      stats = await ingestCSV({
        stream, supabase,
        workspace_id: supplier.workspace_id,
        supplier_id: supplier.id,
        ingestion_id: ing.id,
        source_file: sourceLabel
      })
    } else if (type === 'json') {
      stats = await ingestJSON({
        stream, supabase,
        workspace_id: supplier.workspace_id,
        supplier_id: supplier.id,
        ingestion_id: ing.id,
        source_file: sourceLabel
      })
    } else {
      // XML (buffer-based first pass)
      stats = await ingestXMLBuffer({
        stream, supabase,
        workspace_id: supplier.workspace_id,
        supplier_id: supplier.id,
        ingestion_id: ing.id,
        source_file: sourceLabel
      })
    }

    const status =
      stats.errors === 0 ? 'success'
      : stats.ok > 0 ? 'partial'
      : 'error'

    await supabase
      .from('feed_ingestions')
      .update({
        finished_at: new Date().toISOString(),
        status,
        items_total: stats.total,
        items_ok: stats.ok,
        items_error: stats.errors
      })
      .eq('id', ing.id)

    return NextResponse.json({ ok: true, ingestion_id: ing.id, stats, type })
  } catch (e: any) {
    await supabase
      .from('feed_ingestions')
      .update({
        finished_at: new Date().toISOString(),
        status: 'error',
        error_message: e?.message || 'Unknown error'
      })
      .eq('id', ing.id)

    return NextResponse.json({ error: e?.message || 'Ingestion failed' }, { status: 500 })
  }
}
