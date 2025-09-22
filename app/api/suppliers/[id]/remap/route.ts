import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabaseServer'

type FieldDef = { key: string; datatype: string }

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
        if (['1','true','yes','y'].includes(s)) return true
        if (['0','false','no','n'].includes(s)) return false
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

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient()
  const { data: auth } = await supabase.auth.getUser()
  if (!auth?.user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  // Load supplier (to get workspace_id)
  const { data: supplier, error: sErr } = await supabase
    .from('suppliers')
    .select('id, workspace_id')
    .eq('id', params.id)
    .single()
  if (sErr || !supplier) return NextResponse.json({ error: sErr?.message || 'Supplier not found' }, { status: 404 })

  const wsId = supplier.workspace_id
  const supplierId = supplier.id

  // Load field definitions
  const { data: fields, error: fErr } = await supabase
    .from('custom_fields')
    .select('key, datatype')
    .eq('workspace_id', wsId)
    .order('sort_order', { ascending: true })
  if (fErr) return NextResponse.json({ error: fErr.message }, { status: 400 })

  const fieldDefs: FieldDef[] = fields || []
  const fieldByKey = new Map(fieldDefs.map(f => [f.key, f]))

  // Load mappings: source_key -> field_key
  const { data: maps, error: mErr } = await supabase
    .from('field_mappings')
    .select('source_key, field_key')
    .eq('workspace_id', wsId)
    .eq('supplier_id', supplierId)
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 400 })

  const mapSrcToDst = new Map<string, string>()
  for (const r of maps || []) {
    mapSrcToDst.set(String(r.source_key).toLowerCase(), String(r.field_key))
  }

  // Pull recent raw items (you can remove the limit if you want to remap everything)
  const { data: raws, error: rErr } = await supabase
    .from('products_raw')
    .select('external_id, raw, source_file, ingestion_id')
    .eq('workspace_id', wsId)
    .eq('supplier_id', supplierId)
    .order('imported_at', { ascending: false })
    .limit(5000)
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 400 })

  // Build upsert payload for products_mapped
  const payload = (raws || []).map((row) => {
    const raw = row.raw && typeof row.raw === 'object' ? row.raw : {}
    const flatRaw: Record<string, any> = Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k.toLowerCase(), v])
    )

    const fields: Record<string, any> = {}

    // 1) Apply explicit mappings
    for (const [srcLower, dstFieldKey] of mapSrcToDst.entries()) {
      const def = fieldByKey.get(dstFieldKey)
      if (!def) continue
      const rawVal = flatRaw[srcLower]
      fields[def.key] = coerceDatatype(rawVal, def.datatype)
    }

    // 2) Best-effort fill for unmapped fields by matching same-name key
    for (const def of fieldDefs) {
      if (fields[def.key] !== undefined) continue
      const v = flatRaw[def.key.toLowerCase()]
      fields[def.key] = coerceDatatype(v, def.datatype)
    }

    return {
      workspace_id: wsId,
      supplier_id: supplierId,
      ingestion_id: row.ingestion_id ?? null,
      external_id: row.external_id,
      fields,
      source_file: row.source_file ?? null,
    }
  })

  if (payload.length === 0) {
    return NextResponse.json({ ok: true, updated: 0 })
  }

  const { error: uErr } = await supabase
    .from('products_mapped')
    .upsert(payload, { onConflict: 'workspace_id,supplier_id,external_id', ignoreDuplicates: false })
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 400 })

  return NextResponse.json({ ok: true, updated: payload.length })
}
