import { NextResponse } from 'next/server'
import { Readable } from 'stream'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { detectFeedType, ingestCSV, ingestJSON, ingestXMLBuffer } from '@/lib/ingest'

const UPLOADS_BUCKET = process.env.NEXT_PUBLIC_SUPPLIER_UPLOADS_BUCKET || 'supplier-uploads'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: routeId } = await ctx.params
  const supabase = await createSupabaseServerClient()

  // Auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // Supplier (+ uid_source_key)
  const { data: sup, error: supErr } = await supabase
    .from('suppliers')
    .select('id, workspace_id, source_type, endpoint_url, source_path, auth_username, auth_password, uid_source_key')
    .eq('id', routeId)
    .single()
  if (supErr || !sup) return NextResponse.json({ error: supErr?.message || 'Supplier not found' }, { status: 404 })
  if (!sup.uid_source_key) {
    return NextResponse.json({ error: 'UID source key is missing. Set it in step 3 of the wizard (Unique Identifier) before importing.' }, { status: 400 })
  }

  // Prepare stream
  let stream: Readable
  let hint = ''
  let contentType = ''

  if (sup.source_type === 'url') {
    if (!sup.endpoint_url) return NextResponse.json({ error: 'endpoint_url is missing for URL source' }, { status: 400 })

    const headers: Record<string, string> = {}
    if (sup.auth_username && sup.auth_password) {
      headers.Authorization = 'Basic ' + Buffer.from(`${sup.auth_username}:${sup.auth_password}`).toString('base64')
    }

    const resp = await fetch(sup.endpoint_url, { headers })
    if (!resp.ok) {
      return NextResponse.json({ error: `Failed to fetch: ${resp.status} ${resp.statusText}` }, { status: 400 })
    }
    hint = sup.endpoint_url
    contentType = resp.headers.get('content-type') || ''
    const ab = await resp.arrayBuffer()
    stream = Readable.from(Buffer.from(ab))
  } else if (sup.source_type === 'upload') {
    if (!sup.source_path) return NextResponse.json({ error: 'source_path is missing for uploaded source' }, { status: 400 })
    const { data, error } = await supabase.storage.from(UPLOADS_BUCKET).download(sup.source_path)
    if (error) return NextResponse.json({ error: `Download failed: ${error.message}` }, { status: 400 })
    const ab = await data.arrayBuffer()
    stream = Readable.from(Buffer.from(ab))
    hint = sup.source_path
  } else {
    return NextResponse.json({ error: `Unknown source_type: ${sup.source_type}` }, { status: 400 })
  }

  const type = detectFeedType(hint, contentType)
  const ingestion_id = crypto.randomUUID()

  // 1) Create feed_ingestions **with only guaranteed columns**
  {
    const { error } = await supabase.from('feed_ingestions').insert({
      id: ingestion_id,
      workspace_id: sup.workspace_id,
      supplier_id: sup.id,
    })
    if (error) {
      return NextResponse.json({ error: `Could not create feed_ingestions: ${error.message}` }, { status: 400 })
    }
    // Set started_at + pending
    await supabase.from('feed_ingestions').update({
      status: 'pending',
      started_at: new Date().toISOString(),
    }).eq('id', ingestion_id)
  }

  try {
    // 2) Ingest
    let stats
    if (type === 'csv') {
      stats = await ingestCSV({
        stream,
        supabase,
        workspace_id: sup.workspace_id,
        supplier_id: sup.id,
        ingestion_id,
        uid_source_key: sup.uid_source_key,
        source_file: sup.source_type === 'upload' ? sup.source_path : undefined,
      })
    } else if (type === 'json') {
      stats = await ingestJSON({
        stream,
        supabase,
        workspace_id: sup.workspace_id,
        supplier_id: sup.id,
        ingestion_id,
        uid_source_key: sup.uid_source_key,
        source_file: sup.source_type === 'upload' ? sup.source_path : undefined,
      })
    } else {
      stats = await ingestXMLBuffer({
        stream,
        supabase,
        workspace_id: sup.workspace_id,
        supplier_id: sup.id,
        ingestion_id,
        uid_source_key: sup.uid_source_key,
        source_file: sup.source_type === 'upload' ? sup.source_path : undefined,
      })
    }

    const nowIso = new Date().toISOString()

    // 3) UPDATE with finished_at + status + counts together (satisfy CHECK constraints)
    const { error: updErr } = await supabase.from('feed_ingestions').update({
      finished_at: nowIso,
      status: 'completed',
      total_count: stats?.total ?? 0,
      ok_count: stats?.ok ?? 0,
      error_count: stats?.errors ?? 0,
    }).eq('id', ingestion_id)

    // Fallback if counts columns not present
    if (updErr) {
      await supabase.from('feed_ingestions').update({
        finished_at: nowIso,
        status: 'completed',
      }).eq('id', ingestion_id)
    }

    return NextResponse.json({ ok: true, ingestion_id, stats, type })
  } catch (e: any) {
    const nowIso = new Date().toISOString()
    await supabase.from('feed_ingestions').update({
      finished_at: nowIso,
      status: 'failed',
      error_message: e?.message || 'Ingestion failed',
    }).eq('id', ingestion_id)

    return NextResponse.json({ error: e?.message || 'Ingestion failed' }, { status: 500 })
  }
}
