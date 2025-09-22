// app/suppliers/new/page.tsx
'use client'

import React, { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { createBrowserClient } from '@supabase/ssr'

type FieldOpt = { key: string; name: string }
type Row = { source: string; field: string }

const BUCKET = process.env.NEXT_PUBLIC_SUPPLIER_UPLOADS_BUCKET || 'supplier-uploads'

export default function NewSupplierWizardPage() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [supplierId, setSupplierId] = useState<string | null>(null)

  // step 1 state
  const [sourceType, setSourceType] = useState<'url' | 'upload'>('url')
  const [endpointUrl, setEndpointUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [authUsername, setAuthUsername] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [s1Error, setS1Error] = useState<string | null>(null)
  const [isPendingS1, startS1] = useTransition()

  // step 2 (mapping) state
  const [feedKeys, setFeedKeys] = useState<string[]>([])
  const [fields, setFields] = useState<FieldOpt[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [loadingMap, setLoadingMap] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [isPendingMap, startMap] = useTransition()

  // step 3 state (meta + import)
  const [name, setName] = useState('')
  const [schedule, setSchedule] = useState('')
  const [s3Error, setS3Error] = useState<string | null>(null)
  const [isPendingS3, startS3] = useTransition()

  // ===== helpers =====
  function setRow(idx: number, next: Partial<Row>) {
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, ...next } : r)))
  }
  function addRow() { setRows(prev => [...prev, { source: '', field: '' }]) }
  function removeRow(idx: number) { setRows(prev => prev.filter((_, i) => i !== idx)) }
  function dedupeRows(list: Row[]): Row[] {
    const map = new Map<string, Row>()
    for (const r of list) if (r.source) map.set(r.source, r)
    const empties = list.filter(r => !r.source)
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

  // ===== step 1: create minimal supplier (or upload file then create) =====
  async function handleStep1Create() {
    setS1Error(null)
    // if upload → push to storage, then pass source_path to API
    let source_path: string | undefined
    try {
      if (sourceType === 'upload') {
        if (!file) {
          setS1Error('Please choose a file to upload.')
          return
        }
        const ext = file.name.split('.').pop() || 'dat'
        const key = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(key, file, {
          upsert: false,
          contentType: file.type || undefined,
        })
        if (upErr) { setS1Error(`Upload failed: ${upErr.message}`); return }
        source_path = key
      }
    } catch (e: any) {
      setS1Error(e?.message || 'Upload failed')
      return
    }

    // call API to create minimal supplier
    startS1(async () => {
      const res = await fetch('/api/suppliers/create-min', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_type: sourceType,
          endpoint_url: sourceType === 'url' ? endpointUrl.trim() : null,
          source_path: sourceType === 'upload' ? source_path || null : null,
          auth_username: authUsername || null,
          auth_password: authPassword || null,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(()=>({}))
        setS1Error(j?.error || 'Failed to create supplier')
        return
      }
      const j = await res.json()
      setSupplierId(j.id)
      setStep(2)
    })
  }

  // ===== step 2: load keys + fields + existing mappings for this supplierId =====
  useEffect(() => {
    if (!supplierId || step !== 2) return
    let cancelled = false
    ;(async () => {
      setLoadingMap(true)
      setMapError(null)
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

        const existing: Record<string, string> = {}
        if (Array.isArray(mRes?.mappings)) {
          for (const m of mRes.mappings) existing[String(m.source_key)] = String(m.field_key)
        }

        const initialRows: Row[] = []
        for (const k of keysArr) initialRows.push({ source: k, field: existing[k] || '' })
        for (const [src, dst] of Object.entries(existing)) {
          if (!keysArr.includes(src)) initialRows.push({ source: src, field: dst })
        }
        setRows(initialRows.length ? initialRows : [{ source: '', field: '' }])
      } catch (e: any) {
        if (!cancelled) setMapError(e?.message || 'Failed to load mapping data')
      } finally {
        if (!cancelled) setLoadingMap(false)
      }
    })()
    return () => { cancelled = true }
  }, [supplierId, step])

  async function saveMappingsForSupplier() {
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

  // ===== step 3: set name + schedule, (optional) run import =====
  async function saveMeta() {
    setS3Error(null)
    if (!supplierId) { setS3Error('Missing supplier id'); return }
    const res = await fetch(`/api/suppliers/${supplierId}/update-meta`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), schedule: schedule.trim() || null }),
    })
    if (!res.ok) {
      const j = await res.json().catch(()=>({}))
      setS3Error(j?.error || 'Failed to save')
      return
    }
  }
  async function runImportNow() {
    if (!supplierId) return
    await fetch(`/api/suppliers/${supplierId}/ingest`, { method: 'POST' })
    router.push('/suppliers')
    router.refresh()
  }

  return (
    <main className="p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Add Supplier</h1>
          <Link href="/suppliers" className="btn">Back to suppliers</Link>
        </div>

        {/* Stepper */}
        <div className="flex gap-2 text-sm">
          <div className={`px-3 py-1 rounded ${step === 1 ? 'bg-gray-900 text-white' : 'bg-gray-200'}`}>1. Source</div>
          <div className={`px-3 py-1 rounded ${step === 2 ? 'bg-gray-900 text-white' : 'bg-gray-200'}`}>2. Map</div>
          <div className={`px-3 py-1 rounded ${step === 3 ? 'bg-gray-900 text-white' : 'bg-gray-200'}`}>3. Details</div>
        </div>

        {/* STEP 1 */}
        {step === 1 && (
          <div className="rounded-2xl border bg-card p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-1">
                <label className="label">Source type</label>
                <Select value={sourceType} onChange={(e)=>setSourceType(e.target.value as any)}>
                  <option value="url">URL</option>
                  <option value="upload">Upload file</option>
                </Select>
              </div>
              {sourceType === 'url' ? (
                <div className="md:col-span-2">
                  <label className="label">Feed URL</label>
                  <Input placeholder="https://..." value={endpointUrl} onChange={(e)=>setEndpointUrl(e.target.value)} />
                </div>
              ) : (
                <div className="md:col-span-2">
                  <label className="label">Feed file</label>
                  <input type="file" onChange={(e)=>setFile(e.target.files?.[0] ?? null)} className="block w-full" />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">Auth username (optional)</label>
                <Input value={authUsername} onChange={(e)=>setAuthUsername(e.target.value)} />
              </div>
              <div>
                <label className="label">Auth password (optional)</label>
                <Input type="password" value={authPassword} onChange={(e)=>setAuthPassword(e.target.value)} />
              </div>
            </div>

            {s1Error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{s1Error}</div>}

            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                disabled={isPendingS1 || (sourceType === 'url' ? !endpointUrl.trim() : !file)}
                onClick={() => startS1(handleStep1Create)}
              >
                {isPendingS1 ? 'Creating…' : 'Continue to mapping'}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && supplierId && (
          <div className="rounded-2xl border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Map Fields</h2>
              <div className="flex items-center gap-2">
                <Button onClick={() => setStep(1)}>Back</Button>
              </div>
            </div>

            {mapError && <div className="rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2">{mapError}</div>}
            {loadingMap ? (
              <div className="text-muted">Loading feed keys…</div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3">
                  {rows.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-10 items-center gap-2">
                      <div className="md:col-span-4">
                        <Select
                          value={row.source}
                          onChange={(e)=>setRow(idx, { source: e.target.value })}
                        >
                          <option value="">— Select feed key —</option>
                          {selectableFeedKeys.map(k => <option key={`${k}-${idx}`} value={k}>{k}</option>)}
                        </Select>
                      </div>
                      <div className="md:col-span-5">
                        <Select
                          value={row.field}
                          onChange={(e)=>setRow(idx, { field: e.target.value })}
                        >
                          <option value="">— Select workspace field —</option>
                          {fieldOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </Select>
                      </div>
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
                    disabled={isPendingMap}
                    onClick={() =>
                      startMap(async () => {
                        try {
                          await saveMappingsForSupplier()
                          setStep(3)
                        } catch (e: any) {
                          setMapError(e?.message || 'Failed to save mappings')
                        }
                      })
                    }
                  >
                    {isPendingMap ? 'Saving…' : 'Continue to details'}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && supplierId && (
          <div className="rounded-2xl border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Details & Import</h2>
              <div className="flex items-center gap-2">
                <Button onClick={() => setStep(2)}>Back</Button>
                <Link href={`/suppliers/${supplierId}/map`} className="btn">Edit mappings</Link>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">Name</label>
                <Input value={name} onChange={(e)=>setName(e.target.value)} placeholder="Supplier name" />
              </div>
              <div>
                <label className="label">Schedule (cron-friendly string, optional)</label>
                <Input value={schedule} onChange={(e)=>setSchedule(e.target.value)} placeholder="e.g. 0 3 * * *" />
              </div>
            </div>

            {s3Error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{s3Error}</div>}

            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                disabled={isPendingS3 || !name.trim()}
                onClick={() => startS3(async () => {
                  await saveMeta()
                })}
              >
                {isPendingS3 ? 'Saving…' : 'Save'}
              </Button>

              <Button
                onClick={runImportNow}
              >
                Import now
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
