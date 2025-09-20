'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useActionState } from 'react' // ✅ React 19 API
import { createSupplierAction } from '../(dashboard)/actions/supplierActions'

const initialState = { error: null as string | null }

export default function SupplierFormModal() {
  const [open, setOpen] = useState(false)
  const [sourceType, setSourceType] = useState<'url' | 'upload'>('url')
  const [name, setName] = useState('')
  const [endpointUrl, setEndpointUrl] = useState('')
  const router = useRouter()

  const [state, formAction] = useActionState(createSupplierAction, initialState)

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
          <div className="bg-white text-gray-900 rounded-lg shadow-lg w-full max-w-md p-6">
            <h2 className="text-lg font-semibold mb-4">Add a new supplier</h2>
            <form action={formAction} className="space-y-3">
              <input
                type="text"
                name="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Supplier name"
                className="border rounded px-3 py-2 w-full"
                required
              />

              <select
                name="source_type"
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as 'url' | 'upload')}
                className="border rounded px-3 py-2 w-full"
              >
                <option value="url">URL</option>
                <option value="upload">Upload</option>
              </select>

              {sourceType === 'url' ? (
                <input
                  type="url"
                  name="endpoint_url"
                  value={endpointUrl}
                  onChange={(e) => setEndpointUrl(e.target.value)}
                  placeholder="Feed URL"
                  className="border rounded px-3 py-2 w-full"
                  required
                />
              ) : (
                <input
                  type="file"
                  name="feed_file"
                  accept=".xml,.csv,.json"
                  className="border rounded px-3 py-2 w-full"
                  required
                />
              )}

              {state.error && (
                <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
                  {state.error}
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
                  className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-500"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
