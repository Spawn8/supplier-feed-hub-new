// app/suppliers/new/page.tsx
'use client'

import React, { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { createBrowserClient } from '@supabase/ssr'

type FieldOpt = { key: string; name: string }
type Row = { field: string; source: string }

const BUCKET = process.env.NEXT_PUBLIC_SUPPLIER_UPLOADS_BUCKET || 'supplier-uploads'

export default function NewSupplierWizardPage() {
  const router = useRouter()
  const search = useSearchParams()
  const resumeId = search.get('supplier') // resume drafts via ?supplier=id

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [supplierId, setSupplierId] = useState<string | null>(null)

  // step 1
  const [sourceType, setSourceType] = useState<'url' | 'upload'>('url')
  const [endpointUrl, setEndpointUrl] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [authUsername, setAuthUsername] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [s1Error, setS1Error] = useState<string | null>(null)
  const [isPendingS1, startS1] = useTransition()

  // step 2 (mapping)
  const [feedKeys, setFeedKeys] = useState<string[]>([])
  const [fields, setFields] = useState<FieldOpt[]>([])
  const [rows, setRows] = useState<Row[]>([])
  const [loadingMap, setLoadingMap] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [isPendingMap, startMap] = useTransition()
  const initializedRows = useRef(false)

  // step 3 (meta + UID + finish)
  const [name, setName] = useState('')
  const [schedule, setSchedule] = useState('')
  const [uidSourceKey, setUidSourceKey] = useState<string>('') // REQUIRED to finish (if not locked)
  const [lockedUidSourceKey, setLockedUidSourceKey] = useState<string | null>(null)
  const [s3Error, setS3Error] = useState<string | null>(null)

  // one-button finish state
  const [isFinishing, setIsFinishing] = useState(false)
  const [finishError, setFinishError] = useState<string | null>(null)
  const [finishResult, setFinishResult] = useState<{
    ingestion_id?: string
    stats?: { total: number; ok: number; errors: number }
    type?: string
  } | null>(null)

  // Resume drafts
  useEffect(() => {
    if (resumeId && !supplierId) {
      setSupplierId(resumeId)
      setStep(2)
    }
  }, [resumeId, supplierId])

  function setRow(i: number, next: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...next } : r)))
  }
  function addRow() {
    setRows((prev) => [...prev, { field: '', source: '' }])
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i))
  }
  function dedupeRows(list: Row[]): Row[] {
    const map = new Map<string, Row>()
    for (const r of list) if (r.field) map.set(r.field, r)
    const empties = list.filter((r) => !r.field)
    return [...Array.from(map.values()), ...empties]
  }

  const fieldOptions = useMemo(
    () => fields.map((f) => ({ value: f.key, label: `${f.name} (${f.key})` })),
    [fields]
  )
  const selectableFeedKeys = useMemo(() => {
    const current = rows.map((r) => r.source).filter(Boolean)
    const extra = current.filter((k) => !feedKeys.includes(k))
    return [...feedKeys, ...extra]
  }, [feedKeys, rows])

  async function handleStep1Create() {
    if (resumeId) {
      setStep(2)
      return
    }

    setS1Error(null)
    let source_path: string | undefined
    try {
      if (sourceType === 'upload') {
        if (!file) {
          setS1Error('Please choose a file to upload.')
          return
        }
        const ext = file.name.split('.').pop() || 'dat'
        const key = `uploads/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.${ext}`
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(key, file, {
            upsert: false,
            contentType: file.type || undefined,
          })
        if (upErr) {
          setS1Error(`Upload failed: ${upErr.message}`)
          return
        }
        source_path = key
      }
    } catch (e: any) {
      setS1Error(e?.message || 'Upload failed')
      return
    }

    // Create a minimal supplier now (needed for sample-keys & mappings APIs)
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
        const j = await res.json().catch(() => ({}))
        setS1Error(j?.error || 'Failed to create supplier')
        return
      }
      const j = await res.json()
      setSupplierId(j.id)
      initializedRows.current = false
      setStep(2)
    })
  }

  // Load mapping data
  useEffect(() => {
    if (!supplierId || step !== 2) return
    let cancelled = false
    ;(async () => {
      setLoadingMap(true)
      setMapError(null)
      try {
        const [kRes, fRes, mRes] = await Promise.all([
          fetch(`/api/suppliers/${supplierId}/sample-keys`).then((r) =>
            r.json()
          ),
          fetch(`/api/fields/list`).then((r) => r.json()),
          fetch(`/api/suppliers/${supplierId}/field-mappings`).then((r) =>
            r.json()
          ),
        ])
        if (cancelled) return
        const keysArr: string[] = Array.isArray(kRes?.keys) ? kRes.keys : []
        setFeedKeys(keysArr)
        const fieldArr: FieldOpt[] = Array.isArray(fRes?.fields)
          ? fRes.fields
          : []
        setFields(fieldArr)

        const existing = new Map<string, string>()
        for (const m of mRes?.mappings || []) {
          existing.set(String(m.field_key), String(m.source_key))
        }

        if (!initializedRows.current) {
          const initial: Row[] =
            fieldArr.length > 0
              ? fieldArr.map((f) => ({
                  field: f.key,
                  source: existing.get(f.key) || '',
                }))
              : [{ field: '', source: '' }]
          setRows(initial)
          initializedRows.current = true
        }
      } catch (e: any) {
        if (!cancelled)
          setMapError(e?.message || 'Failed to load mapping data')
      } finally {
        if (!cancelled) setLoadingMap(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [supplierId, step])

  async function saveMappingsForSupplier() {
    const cleaned = dedupeRows(rows).filter((r) => r.field && r.source)
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

  // Step 3: load details (to know if UID is already locked)
  useEffect(() => {
    if (!supplierId || step !== 3) return
    ;(async () => {
      const r = await fetch(`/api/suppliers/${supplierId}/details`)
        .then((r) => r.json())
        .catch(() => null)
      if (r?.uid_source_key) setLockedUidSourceKey(r.uid_source_key)
      if (r?.name) setName(r.name)
      if (r?.schedule) setSchedule(r.schedule)
    })()
  }, [supplierId, step])

  async function finishAndImport() {
    setFinishError(null)
    setFinishResult(null)
    setIsFinishing(true)

    try {
      if (!supplierId) throw new Error('Missing supplier id')
      if (!name.trim()) throw new Error('Please enter a supplier name')
      const uidKey = lockedUidSourceKey || uidSourceKey
      if (!uidKey) throw new Error('Select a UID source key before finishing')

      // 1) Save mappings (ensure step 2 is persisted)
      await saveMappingsForSupplier()

      // 2) Lock UID if not locked yet
      if (!lockedUidSourceKey) {
        const resUID = await fetch(
          `/api/suppliers/${supplierId}/set-uid-source`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid_source_key: uidKey }),
          }
        )
        if (!resUID.ok) {
          const j = await resUID.json().catch(() => ({}))
          throw new Error(j?.error || 'Failed to lock UID')
        }
        setLockedUidSourceKey(uidKey)
      }

      // 3) Save meta (name/schedule) and mark not draft (on server route)
      const resMeta = await fetch(`/api/suppliers/${supplierId}/update-meta`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          schedule: schedule.trim() || null,
        }),
      })
      if (!resMeta.ok) {
        const j = await resMeta.json().catch(() => ({}))
        throw new Error(j?.error || 'Failed to save details')
      }

      // 4) Run import
      const resIngest = await fetch(
        `/api/suppliers/${supplierId}/ingest`,
        { method: 'POST' }
      )
      const json = await resIngest.json().catch(() => ({}))
      if (!resIngest.ok) {
        throw new Error(json?.error || 'Import failed')
      }

      // 5) Show results
      setFinishResult({
        ingestion_id: json.ingestion_id,
        stats: json.stats,
        type: json.type,
      })
    } catch (e: any) {
      setFinishError(e?.message || 'Failed to finish & import')
    } finally {
      setIsFinishing(false)
    }
  }

  return (
    <main className="p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Add Supplier</h1>
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
                <Select
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value as any)}
                >
                  <option value="url">URL</option>
                  <option value="upload">Upload file</option>
                </Select>
              </div>
              {sourceType === 'url' ? (
                <div className="md:col-span-2">
                  <label className="label">Feed URL</label>
                  <Input
                    placeholder="https://..."
                    value={endpointUrl}
                    onChange={(e) => setEndpointUrl(e.target.value)}
                  />
                </div>
              ) : (
                <div className="md:col-span-2">
                  <label className="label">Feed file</label>
                  <input
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="block w-full"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">Auth username (optional)</label>
                <Input
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Auth password (optional)</label>
                <Input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                />
              </div>
            </div>

            {s1Error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {s1Error}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                disabled={
                  isPendingS1 ||
                  (resumeId
                    ? false
                    : sourceType === 'url'
                    ? !endpointUrl.trim()
                    : !file)
                }
                onClick={() => startS1(handleStep1Create)}
              >
                {isPendingS1 ? 'Creating…' : 'Continue to mapping'}
              </Button>
              <Link href="/suppliers" className="btn">
                Cancel
              </Link>
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

            {mapError && (
              <div className="rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2">
                {mapError}
              </div>
            )}
            {loadingMap ? (
              <div className="text-muted">
                Loading workspace fields & feed keys…
              </div>
            ) : (
              <>
                <p className="text-muted mb-2">
                  Left: <strong>workspace field</strong>. Right:{' '}
                  <strong>feed key</strong>.
                </p>

                <div className="grid grid-cols-1 gap-3">
                  {rows.map((row, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 md:grid-cols-10 items-center gap-2"
                    >
                      <div className="md:col-span-4">
                        <Select
                          value={row.field}
                          onChange={(e) => setRow(idx, { field: e.target.value })}
                        >
                          <option value="">— Select workspace field —</option>
                          {fieldOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="md:col-span-5">
                        <Select
                          value={row.source}
                          onChange={(e) =>
                            setRow(idx, { source: e.target.value })
                          }
                        >
                          <option value="">— Select feed key —</option>
                          {selectableFeedKeys.map((k) => (
                            <option key={`${k}-${idx}`} value={k}>
                              {k}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="md:col-span-1">
                        <Button variant="danger" onClick={() => removeRow(idx)}>
                          Remove
                        </Button>
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
                <Button onClick={() => setStep(2)} disabled={isFinishing}>
                  Back
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Supplier name"
                />
              </div>
              <div>
                <label className="label">Schedule (cron string, optional)</label>
                <Input
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  placeholder="e.g. 0 3 * * *"
                />
              </div>
            </div>

            {/* UID selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="label">Unique Identifier (UID) source</label>
                {!lockedUidSourceKey ? (
                  <>
                    <Select
                      value={uidSourceKey}
                      onChange={(e) => setUidSourceKey(e.target.value)}
                    >
                      <option value="">— Select feed key to use as UID —</option>
                      {feedKeys.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </Select>
                    <p className="text-xs text-muted mt-1">
                      This must uniquely identify a product within this
                      supplier’s feed (e.g. code, SKU, EAN). Once saved, it
                      cannot be changed.
                    </p>
                  </>
                ) : (
                  <div className="rounded border px-3 py-2 bg-gray-50">
                    <div className="text-sm">
                      <strong>UID source (locked):</strong> {lockedUidSourceKey}
                    </div>
                    <div className="text-xs text-muted">This setting is immutable.</div>
                  </div>
                )}
              </div>
            </div>

            {(s3Error || finishError) && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {finishError || s3Error}
              </div>
            )}

            {/* Single button: Finish & Import */}
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                disabled={
                  isFinishing ||
                  !name.trim() ||
                  (!lockedUidSourceKey && !uidSourceKey)
                }
                onClick={finishAndImport}
              >
                {isFinishing ? 'Finishing… Importing…' : 'Finish & Import'}
              </Button>
              <Link href="/suppliers" className="btn" aria-disabled={isFinishing}>
                Cancel
              </Link>
            </div>

            {/* Result summary */}
            {finishResult && (
              <div className="mt-4 rounded-2xl border bg-white p-4">
                <div className="font-medium">✅ Import complete</div>
                <div className="text-sm text-muted">
                  Type: {finishResult.type || 'unknown'} • Ingestion ID:{' '}
                  {finishResult.ingestion_id}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded bg-gray-100 p-3">
                    <div className="text-xs text-muted">Total</div>
                    <div className="text-lg font-semibold">
                      {finishResult.stats?.total ?? 0}
                    </div>
                  </div>
                  <div className="rounded bg-gray-100 p-3">
                    <div className="text-xs text-muted">OK</div>
                    <div className="text-lg font-semibold">
                      {finishResult.stats?.ok ?? 0}
                    </div>
                  </div>
                  <div className="rounded bg-gray-100 p-3">
                    <div className="text-xs text-muted">Errors</div>
                    <div className="text-lg font-semibold">
                      {finishResult.stats?.errors ?? 0}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <Link href={`/suppliers/${supplierId}/mapped`} className="btn">
                    View mapped items
                  </Link>
                  <Link href={`/suppliers/${supplierId}/raw`} className="btn">
                    View raw items
                  </Link>
                  <Link href="/suppliers" className="btn btn-primary">
                    Done
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
