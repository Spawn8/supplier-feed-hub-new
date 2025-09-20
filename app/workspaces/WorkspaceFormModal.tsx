'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export default function WorkspaceFormModal() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('Workspace name is required')
      return
    }

    startTransition(async () => {
      const res = await fetch('/api/create-workspace', {
        method: 'POST',
        body: new FormData(Object.assign(document.createElement('form'), { name })),
      })
      if (res.ok) {
        setOpen(false)
        setName('')
        router.refresh()
      } else {
        const { error } = await res.json()
        setError(error || 'Failed to create workspace')
      }
    })
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
      >
        + Add Workspace
      </button>

      {open && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white text-gray-900 rounded-lg shadow-lg w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Create a new workspace</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Workspace name"
                className="border rounded px-3 py-2 w-full"
                required
              />

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-3 py-1.5 border rounded hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
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
