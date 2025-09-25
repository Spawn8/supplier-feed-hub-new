'use client'

import { useEffect, useState } from 'react'

type RunEvtDetail = { supplierId: string }
type Status = 'completed' | 'failed' | 'running' | 'pending' | '—'

type Props = {
  supplierId: string
  initialStatus: Status
  initialTime: string
}

export default function LastImportCell({ supplierId, initialStatus, initialTime }: Props) {
  const key = `ingest:running:${supplierId}`
  const [running, setRunning] = useState<boolean>(false)

  // Initial check for a persisted running flag in this tab
  useEffect(() => {
    try {
      setRunning(!!sessionStorage.getItem(key))
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Listen for explicit start/finish custom events to update immediately
  useEffect(() => {
    const onStart = (e: Event) => {
      const ev = e as CustomEvent<RunEvtDetail>
      if (ev.detail?.supplierId === supplierId) setRunning(true)
    }
    const onFinish = (e: Event) => {
      const ev = e as CustomEvent<RunEvtDetail>
      if (ev.detail?.supplierId === supplierId) setRunning(false)
    }
    window.addEventListener('ingest:running', onStart as EventListener)
    window.addEventListener('ingest:finished', onFinish as EventListener)
    return () => {
      window.removeEventListener('ingest:running', onStart as EventListener)
      window.removeEventListener('ingest:finished', onFinish as EventListener)
    }
  }, [supplierId])

  // If the server already says completed/failed, clear any stale running flag
  useEffect(() => {
    if ((initialStatus === 'completed' || initialStatus === 'failed') && typeof window !== 'undefined') {
      try {
        if (sessionStorage.getItem(key)) {
          sessionStorage.removeItem(key)
          setRunning(false)
        }
      } catch {}
    }
  }, [initialStatus, key])

  const displayStatus =
    running
      ? 'Running'
      : initialStatus === 'pending'
      ? 'Running'
      : initialStatus === '—'
      ? '—'
      : initialStatus.charAt(0).toUpperCase() + initialStatus.slice(1)

  return (
    <div className="leading-tight">
      <div className="capitalize">{displayStatus}</div>
      <div className="font-mono text-xs text-gray-600">{initialTime || '—'}</div>
    </div>
  )
}
