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
      case 'boolean': {
        if (typeof value === 'boolean') return value
        const s = String(value).trim().toLowerCase()
        if (['true', '1', 'yes', 'y', 'on'].includes(s)) return true
        if (['false', '0', 'no', 'n', 'off'].includes(s)) return false
        return null
      }
      case 'string':
      default:
        return String(value)
    }
  } catch {
    return null
  }
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = await createSupabaseServerClient()

  // 1) Load supplier + workspace
  const { data: supplier, error: sErr } = await supabase
    .from('suppliers')
    .select('id, workspace_id')
    .eq('id', id)
    .single()
  if (sErr || !supplier) return NextResponse.json({ error: sErr?.message || 'Supplier not found' }, { status: 404 })

  // 2) Load fields (workspace schema)
  const { data: fields, error: fErr } = await supabase
    .from('custom_fields')
    .select('key, datatype')
    .eq('workspace_id', supplier.workspace_id)
    .order('sort_order', { ascending: true })
  if (fErr) return NextResponse.json({ error: fErr.message }, { status: 400 })
  const defs: FieldDef[] = (fields || []) as any

  // 3) Fetch latest raw rows for this supplier and map them
  const { data: rawRows, error: rErr } = await supabase
    .from('products_raw')
    .select('id, external_id, fields, imported_at')
    .eq('workspace_id', supplier.workspace_id)
    .eq('supplier_id', supplier.id)
    .order('imported_at', { ascending: false })
    .limit(2000)
  if (rErr) return NextResponse.json({ error: rErr.message }, { status: 400 })

  // 4) Transform rows to mapped schema
  const payload = (rawRows || []).map((row: any) => {
    const mapped: Record<string, any> = {}
    for (const def of defs) {
      const v = row.fields?.[def.key]
      mapped[def.key] = coerceDatatype(v, def.datatype)
    }
    return {
      workspace_id: supplier.workspace_id,
      supplier_id: supplier.id,
      external_id: row.external_id,
      fields: mapped,
      imported_at: row.imported_at,
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
