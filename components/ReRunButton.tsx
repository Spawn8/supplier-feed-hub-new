'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'

export default function ReRunButton({ supplierId }: { supplierId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    if (loading) return
    setLoading(true)

    // 1) Mark as running immediately (UI updates instantly)
    try {
      sessionStorage.setItem(`ingest:running:${supplierId}`, JSON.stringify({ startedAt: Date.now() }))
      window.dispatchEvent(new CustomEvent('ingest:running', { detail: { supplierId } }))
    } catch {}

    try {
      // 2) Trigger the ingestion on the server
      await fetch(`/api/suppliers/${supplierId}/ingest`, {
        method: 'POST',
        cache: 'no-store',
      })
      // Let DB writes settle a tick
      await new Promise((r) => setTimeout(r, 800))
    } finally {
      // 3) Clear the running flag BEFORE navigating back
      try {
        sessionStorage.removeItem(`ingest:running:${supplierId}`)
        window.dispatchEvent(new CustomEvent('ingest:finished', { detail: { supplierId } }))
      } catch {}

      // 4) Hard refresh with cache-buster so the server-render shows the new Completed + timestamp
      router.replace(`/suppliers?u=${Date.now()}`)
      setLoading(false)
    }
  }

  return (
    <Button onClick={handleClick} disabled={loading}>
      {loading ? 'Re-running…' : 'Re-run'}
    </Button>
  )
}
