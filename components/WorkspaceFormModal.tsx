'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

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
    if (j?.id && onCreated) onCreated(j.id) // sidebar dropdown instant sync
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-2 rounded-lg border shadow hover:bg-gray-50"
      >
        {buttonLabel}
      </button>

      {open && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white text-gray-900 rounded-lg shadow-lg w-96 p-6">
            <h2 className="text-lg font-semibold mb-4">Create a new workspace</h2>

            <form
              action={(fd: FormData) => {
                fd.set('name', name.trim())
                startTransition(() => createWorkspace(fd))
              }}
              className="grid gap-3"
            >
              <div>
                <label className="text-sm text-gray-600">Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  placeholder="Workspace name"
                  required
                />
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-3 py-1.5 border rounded"
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !name.trim()}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50"
                >
                  {isPending ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
