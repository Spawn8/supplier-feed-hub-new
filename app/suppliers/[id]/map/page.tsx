// app/suppliers/[id]/map/page.tsx
'use client'

import React, { use, useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'

type FieldOpt = { key: string; name: string }
type Row = { source: string; field: string }

// Note: in Next.js 15 Client Components, `params` is a Promise.
export default function SupplierMapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: supplierId } = use(params)
  const router = useRouter()

  const [feedKeys, setFeedKeys] = useState<string[]>([])
  const [fields, setFields] = useState<FieldOpt[]>([])
  const [rows, setRows] = useState<Row[]>([]) // editable mapping rows
  const [isPending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Load feed keys, workspace fields, and existing mappings
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setError(null)
      setLoading(true)
      try {
        const [kRes, fRes, mRes] = await Promise.all([
          fetch(`/api/suppliers/${supplierId}/sample-keys`).then(r => r.json()),
          fetch(`/api/fields/list`).then(r => r.json()),
          fetch(`/api/suppliers/${supplierId}/field-mappings`).then(r => r.json()),
        ])

        if (cancelled) return

        // Feed keys from supplier (XML/CSV/JSON)
        const keysArr: string[] = Array.isArray(kRes?.keys) ? kRes.keys : []
        setFeedKeys(keysArr)

        // Workspace fields (from /fields page)
        const fieldArr: FieldOpt[] = Array.isArray(fRes?.fields) ? fRes.fields : []
        setFields(fieldArr)

        // Existing mappings
        const existing: Record<string, string> = {}
        if (Array.isArray(mRes?.mappings)) {
          for (const m of mRes.mappings) existing[String(m.source_key)] = String(m.field_key)
        }

        // Initial rows = all detected keys + any previously mapped keys not present in this sample
        const initialRows: Row[] = []
        for (const k of keysArr) initialRows.push({ source: k, field: existing[k] || '' })
        for (const [src, dst] of Object.entries(existing)) {
          if (!keysArr.includes(src)) initialRows.push({ source: src, field: dst })
        }

        setRows(initialRows.length ? initialRows : [{ source: '', field: '' }])
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load mapping data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [supplierId])

  const fieldOptions = useMemo(
    () => fields.map(f => ({ value: f.key, label: `${f.name} (${f.key})` })),
    [fields]
  )

  // Allow choosing from detected keys, plus keep any custom/legacy keys already selected in rows
  const selectableFeedKeys = useMemo(() => {
    const currentSelections = rows.map(r => r.source).filter(Boolean)
    const extra = currentSelections.filter(k => !feedKeys.includes(k))
    return [...feedKeys, ...extra]
  }, [feedKeys, rows])

  function setRow(idx: number, next: Partial<Row>) {
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, ...next } : r)))
  }

  function addRow() {
    setRows(prev => [...prev, { source: '', field: '' }])
  }

  function removeRow(idx: number) {
    setRows(prev => prev.filter((_, i) => i !== idx))
  }

  function dedupeRows(list: Row[]): Row[] {
    // Keep the last mapping per source key, plus any placeholder rows (source = '')
    const map = new Map<string, Row>()
    for (const r of list) if (r.source) map.set(r.source, r)
    const empties = list.filter(r => !r.source)
    return [...Array.from(map.values()), ...empties]
  }

  async function saveMappings() {
    setError(null)
    const cleaned = dedupeRows(rows).filter(r => r.source && r.field)
    const mappings: Record<string, string> = {}
    for (const r of cleaned) mappings[r.source] = r.field

    const res = await fetch(`/api/suppliers/${supplierId}/field-mappings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mappings }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j?.error || 'Failed to save mappings')
    }
  }

  return (
    <main className="p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header / Toolbar */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Map Fields</h1>
          <div className="flex items-center gap-2">
            <Link href={`/suppliers/${supplierId}/mapped`} className="btn">View mapped</Link>
            <Link href={`/suppliers/${supplierId}/raw`} className="btn">View items</Link>
            <Link href="/suppliers" className="btn">Back</Link>
          </div>
        </div>

        <p className="text-muted">
          Choose a <strong>feed key</strong> (left) detected from the supplier’s XML/CSV/JSON and map it to a
          <strong> workspace field</strong> (right). Save, then run <em>Import now</em> (or use your remap endpoint)
          to apply mappings to data.
        </p>

        {error && (
          <div className="rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2">
            {error}
          </div>
        )}

        <div className="rounded-2xl border bg-card p-4">
          {loading ? (
            <div className="text-muted">Loading…</div>
          ) : (
            <>
              {/* Rows */}
              <div className="grid grid-cols-1 gap-3">
                {rows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-10 items-center gap-2">
                    {/* LEFT: Feed key (from detected keys) */}
                    <div className="md:col-span-4">
                      <Select
                        value={row.source}
                        onChange={(e) => setRow(idx, { source: e.target.value })}
                      >
                        <option value="">— Select feed key —</option>
                        {selectableFeedKeys.map(k => (
                          <option key={`${k}-${idx}`} value={k}>{k}</option>
                        ))}
                      </Select>
                    </div>

                    {/* RIGHT: Workspace field */}
                    <div className="md:col-span-5">
                      <Select
                        value={row.field}
                        onChange={(e) => setRow(idx, { field: e.target.value })}
                      >
                        <option value="">— Select workspace field —</option>
                        {fieldOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </Select>
                    </div>

                    {/* Remove row */}
                    <div className="md:col-span-1">
                      <Button variant="danger" onClick={() => removeRow(idx)}>
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Controls */}
              <div className="mt-3 flex items-center gap-2">
                <Button onClick={addRow}>+ Add row</Button>
                <div className="text-sm text-muted">
                  Tip: Add rows for keys not visible in this sample (e.g., optional fields).
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Button
                  variant="primary"
                  disabled={isPending}
                  onClick={() =>
                    start(async () => {
                      try {
                        await saveMappings()
                        router.refresh()
                      } catch (e: any) {
                        setError(e?.message || 'Failed to save mappings')
                      }
                    })
                  }
                >
                  {isPending ? 'Saving…' : 'Save mappings'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
