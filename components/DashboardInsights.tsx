'use client'

import { useEffect, useRef, useState } from 'react'

type QueueItem = {
  id: string
  supplier_id?: string
  status: string
  started_at?: string
  completed_at?: string
  items_processed?: number
  items_success?: number
  items_errors?: number
  profile_name?: string
}

type Summary = {
  id: string
  status: string
  started_at: string
  completed_at: string
  duration_ms: number
  items_total: number
  items_success: number
  items_errors: number
  error_message?: string
} | null

export default function DashboardInsights() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [queueImports, setQueueImports] = useState<QueueItem[]>([])
  const [queueExports, setQueueExports] = useState<QueueItem[]>([])
  const [summary, setSummary] = useState<Summary>(null)
  const [topSuppliers, setTopSuppliers] = useState<Array<{ id: string, name: string, count: number }>>([])
  const [errorsList, setErrorsList] = useState<QueueItem[]>([])
  const [snapshot, setSnapshot] = useState<any>(null)
  const snapshotRef = useRef<string>('')

  useEffect(() => {
    fetchInsights()
  }, [])

  useEffect(() => {
    const handler = () => fetchInsights()
    window.addEventListener('dashboard:refresh', handler as any)
    return () => window.removeEventListener('dashboard:refresh', handler as any)
  }, [])

  const fetchInsights = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/dashboard/insights')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load insights')

      const snap = JSON.stringify({
        qi: (data.queue?.imports || []).map((i: any) => i.id),
        qe: (data.queue?.exports || []).map((i: any) => i.id),
        s: data.summary?.id,
        ts: (data.top_suppliers || []).map((t: any) => t.id).slice(0, 3),
        er: (data.errors || []).map((e: any) => e.id).slice(0, 3),
        sn: data.snapshot,
      })
      if (snap !== snapshotRef.current) {
        snapshotRef.current = snap
        setQueueImports(data.queue?.imports || [])
        setQueueExports(data.queue?.exports || [])
        setSummary(data.summary || null)
        setTopSuppliers(data.top_suppliers || [])
        setErrorsList(data.errors || [])
        setSnapshot(data.snapshot || null)
      }
      setError(null)
    } catch (e: any) {
      setError(e.message || 'Failed to load insights')
    } finally {
      setLoading(false)
    }
  }

  const fmt = (d?: string) => (d ? new Date(d).toLocaleString() : '-')
  const ms = (n?: number) => (n ? `${(n/1000).toFixed(1)}s` : '-')

  return (
    <div className="bg-white p-6 rounded-lg shadow dashboard-insights-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Insights</h3>
        <button onClick={fetchInsights} className="text-sm text-gray-500 hover:text-gray-700">Refresh</button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded px-3 py-2">{error}</div>
      )}

      {loading && (
        <div className="animate-pulse h-24 bg-gray-100 rounded" />
      )}

      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Queue */}
          <div className="dashboard-insights-queue">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Import/Export Queue</h4>
            {queueImports.length === 0 && queueExports.length === 0 ? (
              <p className="text-sm text-gray-500">No running jobs</p>
            ) : (
              <div className="space-y-2">
                {queueImports.map((q) => (
                  <div key={q.id} className="flex items-center justify-between text-sm bg-blue-50 border border-blue-200 text-blue-800 rounded px-3 py-2">
                    <span>Import • {q.supplier_id}</span>
                    <span>{q.items_success ?? 0}/{q.items_processed ?? 0} ok</span>
                  </div>
                ))}
                {queueExports.map((q) => (
                  <div key={q.id} className="flex items-center justify-between text-sm bg-purple-50 border border-purple-200 text-purple-800 rounded px-3 py-2">
                    <span>Export • {q.profile_name || q.id}</span>
                    <span>{fmt(q.started_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="dashboard-insights-summary">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Last Sync Summary</h4>
            {summary ? (
              <div className="text-sm text-gray-700 space-y-1">
                <div>Result: <span className={summary.status === 'completed' ? 'text-green-600' : 'text-red-600'}>{summary.status}</span></div>
                <div>Duration: {ms(summary.duration_ms)}</div>
                <div>Processed: {summary.items_success}/{summary.items_total} {summary.items_errors ? <span className="text-red-600">({summary.items_errors} errors)</span> : null}</div>
                <div>Completed: {fmt(summary.completed_at)}</div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No completed sync yet</p>
            )}
          </div>

          {/* Error summary */}
          <div className="dashboard-insights-errors">
            <h4 className="text-sm font-medium text-gray-900 mb-2">Latest Failed Syncs</h4>
            {errorsList.length === 0 ? (
              <p className="text-sm text-gray-500">No failures</p>
            ) : (
              <ul className="text-sm text-gray-700 space-y-1">
                {errorsList.map((e) => (
                  <li key={e.id} className="flex items-center justify-between"><span>{e.id.slice(0,8)}…</span><span>{fmt(e.completed_at)}</span></li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}


