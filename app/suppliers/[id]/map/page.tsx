// app/suppliers/[id]/map/page.tsx
'use client'

import React, { use, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'

type FieldOpt = { key: string; name: string }
type Row = { field: string; source: string }

// Note: in Next.js 15 Client Components, `params` is a Promise.
export default function SupplierMapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: supplierId } = use(params)
  const router = useRouter()

  const [feedKeys, setFeedKeys] = useState<string[]>([])
  const [fields, setFields] = useState<FieldOpt[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, start] = useTransition()
  const initializedRows = useRef(false)

  function setRow(idx: number, next: Partial<Row>) {
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, ...next } : r)))
  }
  function addRow() { setRows(prev => [...prev, { field: '', source: '' }]) }
  function removeRow(idx: number) { setRows(prev => prev.filter((_, i) => i !== idx)) }

  function dedupeRows(list: Row[]): Row[] {
    const map = new Map<string, Row>()
    for (const r of list) if (r.field) map.set(r.field, r)
    const empties = list.filter(r => !r.field)
    return [...Array.from(map.values()), ...empties]
  }

  const fieldOptions = useMemo(
    () => fields.map(f => ({ value: f.key, label: `${f.name} (${f.key})` })),
    [fields]
  )

  const selectableFeedKeys = useMemo(() => {
    const currentSelections = rows.map(r => r.source).filter(Boolean)
    const extra = currentSelections.filter(k => !feedKeys.includes(k))
    return [...feedKeys, ...extra]
  }, [feedKeys, rows])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const [kRes, fRes, mRes] = await Promise.all([
          fetch(`/api/suppliers/${supplierId}/sample-keys`).then(r => r.json()),
          fetch(`/api/fields/list`).then(r => r.json()),
          fetch(`/api/suppliers/${supplierId}/field-mappings`).then(r => r.json()),
        ])

        if (cancelled) return

        const keysArr: string[] = Array.isArray(kRes?.keys) ? kRes.keys : []
        setFeedKeys(keysArr)

        const fieldArr: FieldOpt[] = Array.isArray(fRes?.fields) ? fRes.fields : []
        setFields(fieldArr)

        const existingPairs: Array<{ source_key: string; field_key: string }> = Array.isArray(mRes?.mappings) ? mRes.mappings : []
        const existingByField = new Map<string, string>()
        for (const m of existingPairs) {
          existingByField.set(String(m.field_key), String(m.source_key))
        }

        if (!initializedRows.current) {
          const initialRows: Row[] =
            fieldArr.length > 0
              ? fieldArr.map(f => ({
                  field: f.key,
                  source: existingByField.get(f.key) || '',
                }))
              : [{ field: '', source: '' }]
          setRows(initialRows)
          initializedRows.current = true
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load mapping data')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [supplierId])

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
      const j = await res.json().catch(()=>({}))
      throw new Error(j?.error || 'Failed to save mappings')
    }
  }

  return (
    <main className="p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Map Fields</h1>
          <div className="flex items-center gap-2">
            <Link href={`/suppliers/${supplierId}/mapped`} className="btn">View mapped</Link>
            <Link href={`/suppliers/${supplierId}/raw`} className="btn">View raw</Link>
            <Link href="/suppliers" className="btn">Back</Link>
          </div>
        </div>

        <p className="text-muted">
          Map <strong>workspace fields</strong> (left) to <strong>feed keys</strong> (right).
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
              <div className="grid grid-cols-1 gap-3">
                {rows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-10 items-center gap-2">
                    {/* LEFT: Workspace field */}
                    <div className="md:col-span-4">
                      <Select
                        value={row.field}
                        onChange={(e)=>setRow(idx, { field: e.target.value })}
                      >
                        <option value="">— Select workspace field —</option>
                        {fieldOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </Select>
                    </div>

                    {/* RIGHT: Feed key */}
                    <div className="md:col-span-5">
                      <Select
                        value={row.source}
                        onChange={(e)=>setRow(idx, { source: e.target.value })}
                      >
                        <option value="">— Select feed key —</option>
                        {selectableFeedKeys.map(k => (
                          <option key={`${k}-${idx}`} value={k}>{k}</option>
                        ))}
                      </Select>
                    </div>

                    {/* Remove row */}
                    <div className="md:col-span-1">
                      <Button variant="danger" onClick={()=>removeRow(idx)}>Remove</Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <Button onClick={addRow}>+ Add row</Button>
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
