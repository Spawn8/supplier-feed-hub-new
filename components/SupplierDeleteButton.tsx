'use client'

import { useTransition } from 'react'
import Button from '@/components/ui/Button'
import { useRouter } from 'next/navigation'

export default function SupplierDeleteButton({ id, label = 'Delete' }: { id: string, label?: string }) {
  const [isPending, start] = useTransition()
  const router = useRouter()

  async function handleDelete() {
    if (!confirm('Delete this supplier? This cannot be undone.')) return
    start(async () => {
      const res = await fetch('/api/suppliers/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplier_id: id }),
      })
      if (!res.ok) {
        const j = await res.json().catch(()=>({}))
        alert(j?.error || 'Failed to delete')
        return
      }
      router.refresh()
    })
  }

  return (
    <Button onClick={handleDelete} variant="danger" disabled={isPending}>
      {isPending ? 'Deleting…' : label}
    </Button>
  )
}
