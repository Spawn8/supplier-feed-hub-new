'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'

export default function FieldDeleteButton({ id }: { id: string }) {
  const router = useRouter()
  const [isPending, start] = useTransition()

  return (
    <Button
      variant="danger"
      disabled={isPending}
      onClick={() => {
        if (!confirm('Delete field?')) return
        start(async () => {
          const res = await fetch(`/api/fields/${id}/delete`, { method: 'POST' })
          if (!res.ok) {
            // optionally show a toast
            return
          }
          router.refresh()
        })
      }}
    >
      {isPending ? 'Deleting…' : 'Delete'}
    </Button>
  )
}
