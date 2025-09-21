'use client'

import { useState, useEffect, useActionState, useTransition } from 'react'
import { updateSupplierAction } from '../(dashboard)/actions/supplierActions'

type Supplier = {
  id: string
  name: string
  source_type: 'url' | 'upload'
  endpoint_url: string | null
  schedule: string | null
  auth_username: string | null
  auth_password: string | null
}

export default function SupplierEditModal({ supplier }: { supplier: Supplier }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(supplier.name)
  const [sourceType, setSourceType] = useState<'url' | 'upload'>(supplier.source_type)
  const [endpointUrl, setEndpointUrl] = useState(supplier.endpoint_url ?? '')
  const [schedule, setSchedule] = useState(supplier.schedule ?? '')
  const [authUsername, setAuthUsername] = useState(supplier.auth_username ?? '')
  const [authPassword, setAuthPassword] = useState(supplier.auth_password ?? '')
  const [state, formAction] = useActionState(updateSupplierAction, {})
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if ((state as any)?.ok) setOpen(false)
  }, [state])

  const valid = name.trim().length > 0 && (sourceType === 'upload' || endpointUrl.trim().length > 0)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 rounded border hover:bg-gray-50"
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
                startTransition(() => formAction(fd))
              }}
              className="grid gap-3"
            >
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-600">Name *</label>
                  <input
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="border rounded-lg px-3 py-2 w-full"
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
                  <label className="text-sm text-gray-600">Endpoint URL *</label>
                  <input
                    name="endpoint_url"
                    value={endpointUrl}
                    onChange={(e) => setEndpointUrl(e.target.value)}
                    className="border rounded-lg px-3 py-2 w-full"
                    required
                  />
                </div>
              )}

              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm text-gray-600">Schedule</label>
                  <input
                    name="schedule"
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value)}
                    className="border rounded-lg px-3 py-2 w-full"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Auth username</label>
                  <input
                    name="auth_username"
                    value={authUsername}
                    onChange={(e) => setAuthUsername(e.target.value)}
                    className="border rounded-lg px-3 py-2 w-full"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Auth password</label>
                  <input
                    name="auth_password"
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    className="border rounded-lg px-3 py-2 w-full"
                  />
                </div>
              </div>

              {(state as any)?.error && (
                <div className="rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
                  {(state as any).error}
                </div>
              )}

              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 border rounded hover:bg-gray-100">
                  Cancel
                </button>
                <button type="submit" disabled={!valid || isPending} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50">
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
