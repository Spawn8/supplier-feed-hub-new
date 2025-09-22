'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function WorkspaceFormModal({
  onCreated,
  buttonLabel = 'Add workspace',
}: {
  onCreated?: (id: string) => void
  buttonLabel?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function createWorkspace(fd: FormData) {
    setError(null)
    const res = await fetch('/api/create-workspace', { method: 'POST', body: fd })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j?.error || 'Failed to create workspace.')
      return
    }
    const j = await res.json().catch(() => ({}))
    setOpen(false)
    setName('')
    if (j?.id && onCreated) onCreated(j.id)
    router.refresh()
  }

  return (
    <>
      {/* Primary like Add Supplier */}
      <Button variant="primary" onClick={() => setOpen(true)}>
        + {buttonLabel}
      </Button>

      <Modal
        open={open}
        title="Create a new workspace"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              form="workspace-create-form"
              type="submit"
              variant="primary"
              disabled={isPending || !name.trim()}
            >
              {isPending ? 'Creating…' : 'Create'}
            </Button>
          </>
        }
      >
        <form
          id="workspace-create-form"
          action={(fd: FormData) => {
            fd.set('name', name.trim())
            startTransition(() => createWorkspace(fd))
          }}
          className="grid gap-3"
        >
          <div className="field">
            <label className="label">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Workspace name"
              required
            />
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </div>
          )}
        </form>
      </Modal>
    </>
  )
}
