'use client'

import { useTransition, useState } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'

export default function ImportNowButton({ supplierId }: { supplierId: string }) {
  const router = useRouter()
  const [isPending, start] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="primary"
        onClick={() => {
          setMsg(null)
          start(async () => {
            const res = await fetch(`/api/suppliers/${supplierId}/ingest`, { method: 'POST' })
            if (!res.ok) {
              const j = await res.json().catch(() => ({}))
              setMsg(j?.error || 'Import failed')
              return
            }
            const j = await res.json().catch(() => ({}))
            setMsg(`Imported: ${j?.stats?.ok ?? 0}/${j?.stats?.total ?? 0}`)
            // Ask the server for fresh data (last import status etc.)
            router.refresh()
          })
        }}
        disabled={isPending}
      >
        {isPending ? 'Importing…' : 'Import now'}
      </Button>

      {msg && <span className="text-sm text-muted">{msg}</span>}
    </div>
  )
}
