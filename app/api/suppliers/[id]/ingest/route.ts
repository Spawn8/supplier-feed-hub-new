// app/api/suppliers/[id]/ingest/route.ts
import { NextResponse } from 'next/server'
import { Readable } from 'stream'
import { createSupabaseServerClient } from '@/lib/supabaseServer'
import { detectFeedType, ingestCSV, ingestJSON, ingestXMLBuffer } from '@/lib/ingest'

const UPLOADS_BUCKET = process.env.NEXT_PUBLIC_SUPPLIER_UPLOADS_BUCKET || 'supplier-uploads'

/**
 * Try a series of update variants until one succeeds.
 * This lets us gracefully handle schemas where some columns (status, counts, error_message)
 * or CHECK constraints might not exist/allow the value.
 */
async function tryUpdateVariants(
  supabase: any,
  table: string,
  id: string,
  variants: Record<string, any>[]
) {
  let lastErr: any = null
  for (const payload of variants) {
    const { error } = await supabase.from(table).update(payload).eq('id', id)
    if (!error) return { ok: true as const }
    lastErr = error
  }
  return { ok: false as const, error: lastErr }
}

/**
 * Insert with fallbacks (created_by may not exist in every schema).
 */
async function tryInsertFeedIngestion(
  supabase: any,
  row: { id: string; workspace_id: string; supplier_id: string; created_by?: string }
) {
  // First try with created_by
  let { error } = await supabase.from('feed_ingestions').insert(row)
  if (!error) return { ok: true as const }
  // Fallback without created_by if the column is missing
  const { created_by, ...withoutCreatedBy } = row
  const v2 = await supabase.from('feed_ingestions').insert(withoutCreatedBy)
  if (!v2.error) return { ok: true as const }
  return { ok: false as const, error: v2.error }
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: routeId } = await ctx.params // Next 15: params is a Promise
  const supabase = await createSupabaseServerClient()

  // Auth
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // Supplier (+ uid_source_key)
  const { data: sup, error: supErr } = await supabase
    .from('suppliers')
    .select(
      'id, workspace_id, source_type, endpoint_url, source_path, auth_username, auth_password, uid_source_key'
    )
    .eq('id', routeId)
    .single()

  if (supErr || !sup) {
    return NextResponse.json({ error: supErr?.message || 'Supplier not found' }, { status: 404 })
  }
  if (!sup.uid_source_key) {
    return NextResponse.json(
      {
        error:
          'UID source key is missing. Set it in step 3 of the wizard (Unique Identifier) before importing.',
      },
      { status: 400 }
    )
  }

  // Prepare stream
  let stream: Readable
  let hint = ''
  let contentType = ''

  if (sup.source_type === 'url') {
    if (!sup.endpoint_url)
      return NextResponse.json({ error: 'endpoint_url is missing for URL source' }, { status: 400 })

    const headers: Record<string, string> = {}
    if (sup.auth_username && sup.auth_password) {
      headers.Authorization =
        'Basic ' + Buffer.from(`${sup.auth_username}:${sup.auth_password}`).toString('base64')
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
    if (!sup.source_path)
      return NextResponse.json({ error: 'source_path is missing for uploaded source' }, { status: 400 })
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

  // 1) Create feed_ingestions (with RLS-friendly created_by if present)
  {
    const inserted = await tryInsertFeedIngestion(supabase, {
      id: ingestion_id,
      workspace_id: sup.workspace_id,
      supplier_id: sup.id,
      created_by: user.id,
    })
    if (!inserted.ok) {
      return NextResponse.json(
        { error: `Could not create feed_ingestions: ${inserted.error?.message || 'Unknown error'}` },
        { status: 400 }
      )
    }

    // Mark start ASAP; try status='pending' first, then fallback to just started_at
    const startIso = new Date().toISOString()
    const startUpdate = await tryUpdateVariants(supabase, 'feed_ingestions', ingestion_id, [
      { started_at: startIso, status: 'pending' },
      { started_at: startIso },
    ])
    if (!startUpdate.ok) {
      // Not fatal; continue but report in response
      console.error('Failed to set started_at/status on feed_ingestions:', startUpdate.error?.message)
    }
  }

  try {
    // 2) Ingest
    let stats:
      | { total?: number; ok?: number; errors?: number }
      | undefined

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

    // 3) Mark completion (attempt rich update, then progressively fall back)
    const finishIso = new Date().toISOString()
    const finishUpdate = await tryUpdateVariants(supabase, 'feed_ingestions', ingestion_id, [
      {
        finished_at: finishIso,
        status: 'completed', // if CHECK forbids this, we fallback below
        total_count: stats?.total ?? null,
        ok_count: stats?.ok ?? null,
        error_count: stats?.errors ?? null,
      },
      { finished_at: finishIso, status: 'completed' },
      { finished_at: finishIso }, // minimal guaranteed
    ])

    if (!finishUpdate.ok) {
      console.error('Failed to set finished_at/status on feed_ingestions:', finishUpdate.error?.message)
      // Not fatal for the API response; UI can still infer completion from products_mapped
    }

    return NextResponse.json({ ok: true, ingestion_id, stats, type })
  } catch (e: any) {
    // 4) Mark failure (attempt with status+message, then fall back)
    const finishIso = new Date().toISOString()
    const failUpdate = await tryUpdateVariants(supabase, 'feed_ingestions', ingestion_id, [
      { finished_at: finishIso, status: 'failed', error_message: e?.message || 'Ingestion failed' },
      { finished_at: finishIso, status: 'failed' },
      { finished_at: finishIso },
    ])

    if (!failUpdate.ok) {
      console.error('Failed to set failure status on feed_ingestions:', failUpdate.error?.message)
    }

    return NextResponse.json({ error: e?.message || 'Ingestion failed' }, { status: 500 })
  }
}
