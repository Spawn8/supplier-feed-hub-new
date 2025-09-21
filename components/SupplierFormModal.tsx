'use client'

import { useState, useEffect, useRef, useActionState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createSupplierAction, type CreateSupplierState } from '@/app/(dashboard)/actions/supplierActions'

const initial: CreateSupplierState = {}

export default function SupplierFormModal() {
  const [open, setOpen] = useState(false)
  const [sourceType, setSourceType] = useState<'url' | 'upload'>('url')
  const [name, setName] = useState('')
  const [endpointUrl, setEndpointUrl] = useState('')
  const [schedule, setSchedule] = useState('')
  const [authUsername, setAuthUsername] = useState('')
  const [authPassword, setAuthPassword] = useState('')

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [state, formAction] = useActionState(createSupplierAction, initial)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  useEffect(() => {
    if (state?.ok) {
      // reset & close
      setOpen(false)
      setName('')
      setEndpointUrl('')
      setSchedule('')
      setAuthUsername('')
      setAuthPassword('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      router.refresh()
    }
  }, [state?.ok, router])

  const valid =
    name.trim().length > 0 &&
    ((sourceType === 'url' && endpointUrl.trim().length > 0) ||
      sourceType === 'upload')

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500"
      >
        + Add Supplier
      </button>

      {open && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white text-gray-900 rounded-lg shadow-lg w-full max-w-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">Add a new supplier</h2>

            <form
              action={(fd: FormData) => {
                fd.set('source_type', sourceType)
                fd.set('name', name.trim())
                fd.set('endpoint_url', endpointUrl.trim())
                fd.set('schedule', schedule.trim())
                fd.set('auth_username', authUsername.trim())
                fd.set('auth_password', authPassword.trim())
                startTransition(() => formAction(fd))
              }}
              className="grid gap-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-600">Name</label>
                  <input
                    name="name"
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
                    name="endpoint_url"
                    value={endpointUrl}
                    onChange={(e) => setEndpointUrl(e.target.value)}
                    className="border rounded-lg px-3 py-2 w-full"
                    placeholder="https://example.com/feed.xml"
                  />
                </div>
              )}

              {sourceType === 'upload' && (
                <div>
                  <label className="text-sm text-gray-600">Upload file (XML/CSV/JSON)</label>
                  <input
                    ref={fileInputRef}
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
                    name="schedule"
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value)}
                    placeholder="e.g. hourly | 0 3 * * *"
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

              {state?.error && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                  {state.error}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-50"
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!valid || isPending}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50"
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
