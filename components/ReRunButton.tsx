'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'

export default function ReRunButton({ supplierId }: { supplierId: string }) {
  const router = useRouter()
  const [msg, setMsg] = useState<string | null>(null)
  const [isPending, start] = useTransition()

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={() => {
          setMsg(null)
          start(async () => {
            const res = await fetch(`/api/suppliers/${supplierId}/ingest`, { method: 'POST' })
            if (!res.ok) {
              const j = await res.json().catch(()=>({}))
              setMsg(j?.error || 'Re-run failed')
              return
            }
            setMsg('Re-run started')
            router.refresh()
          })
        }}
        disabled={isPending}
      >
        {isPending ? 'Re-running…' : 'Re-run'}
      </Button>
      {msg && <span className="text-sm text-muted">{msg}</span>}
    </div>
  )
}
