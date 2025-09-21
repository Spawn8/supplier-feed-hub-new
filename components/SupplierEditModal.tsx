'use client'

import { useState, useEffect, useActionState, useTransition } from 'react'
import { updateSupplierAction, type UpdateSupplierState } from '@/app/(dashboard)/actions/supplierActions'

type Supplier = {
  id: string
  name: string
  source_type: 'url' | 'upload'
  endpoint_url: string | null
  schedule: string | null
  auth_username: string | null
  auth_password: string | null
}

const initial: UpdateSupplierState = {}

export default function SupplierEditModal({ supplier }: { supplier: Supplier }) {
  const [open, setOpen] = useState(false)

  const [name, setName] = useState(supplier.name)
  const [sourceType, setSourceType] = useState<'url' | 'upload'>(supplier.source_type)
  const [endpointUrl, setEndpointUrl] = useState(supplier.endpoint_url || '')
  const [schedule, setSchedule] = useState(supplier.schedule || '')
  const [authUsername, setAuthUsername] = useState(supplier.auth_username || '')
  const [authPassword, setAuthPassword] = useState(supplier.auth_password || '')

  const [state, formAction] = useActionState(updateSupplierAction, initial)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (state?.ok) {
      setOpen(false)
    }
  }, [state?.ok])

  const valid =
    name.trim().length > 0 &&
    ((sourceType === 'url' && endpointUrl.trim().length > 0) ||
      sourceType === 'upload')

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-2 py-1 rounded border hover:bg-gray-50"
      >
        Edit
      </button>

      {open && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white text-gray-900 rounded-lg shadow-lg w-full max-w-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">Edit supplier</h2>

            <form
              action={(fd: FormData) => {
                fd.set('id', supplier.id)
                fd.set('source_type', sourceType)
                fd.set('name', name.trim())
                fd.set('endpoint_url', endpointUrl.trim())
                fd.set('schedule', schedule.trim())
                fd.set('auth_username', authUsername.trim())
                fd.set('auth_password', authPassword.trim())

                // Only include a file if user selected one
                const maybeFile = (document.getElementById('edit-file-input-' + supplier.id) as HTMLInputElement | null)?.files?.[0]
                if (maybeFile) {
                  fd.set('file', maybeFile)
                }

                startTransition(() => formAction(fd))
              }}
              className="grid gap-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-600">Name</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="border rounded-lg px-3 py-2 w-full"
                    placeholder="Supplier name"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-600">Source Type</label>
                  <select
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value as 'url' | 'upload')}
                    className="border rounded-lg px-3 py-2 w-full"
                  >
                    <option value="url">URL</option>
                    <option value="upload">Upload file</option>
                  </select>
                </div>
              </div>

              {sourceType === 'url' && (
                <div>
                  <label className="text-sm text-gray-600">Endpoint URL</label>
                  <input
                    value={endpointUrl}
                    onChange={(e) => setEndpointUrl(e.target.value)}
                    className="border rounded-lg px-3 py-2 w-full"
                    placeholder="https://example.com/feed.xml"
                  />
                </div>
              )}

              {sourceType === 'upload' && (
                <div>
                  <label className="text-sm text-gray-600">Replace file (optional)</label>
                  <input
                    id={'edit-file-input-' + supplier.id}
                    name="file"
                    type="file"
                    accept=".xml,.csv,.json,application/xml,text/csv,application/json"
                    className="block w-full text-sm file:mr-3 file:px-4 file:py-2 file:rounded file:border file:bg-gray-50"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm text-gray-600">Schedule</label>
                  <input
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value)}
                    placeholder="e.g. hourly | 0 3 * * *"
                    className="border rounded-lg px-3 py-2 w-full"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Auth username</label>
                  <input
                    value={authUsername}
                    onChange={(e) => setAuthUsername(e.target.value)}
                    className="border rounded-lg px-3 py-2 w-full"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Auth password</label>
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="border rounded-lg px-3 py-2 w-full"
                  />
                </div>
              </div>

              {state?.error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                  {state.error}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 border rounded hover:bg-gray-100">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!valid || isPending}
                  className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50"
                >
                  {isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
