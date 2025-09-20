'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useFormState } from 'react-dom'
import type { CreateSupplierState } from '../(dashboard)/actions/supplierActions'
import { createSupplierAction } from '../(dashboard)/actions/supplierActions'
import { useRouter } from 'next/navigation'

const initialState: CreateSupplierState = {}

export default function SupplierFormModal() {
  const [open, setOpen] = useState(false)
  const [state, formAction] = useFormState(createSupplierAction, initialState)
  const [sourceType, setSourceType] = useState<'url' | 'upload'>('url')
  const [name, setName] = useState('')
  const [endpointUrl, setEndpointUrl] = useState('')
  const [fileChosen, setFileChosen] = useState<File | null>(null)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const router = useRouter()

  // Reset on success
  useEffect(() => {
    if (state?.ok) {
      setOpen(false)
      setName('')
      setEndpointUrl('')
      setFileChosen(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      router.refresh()
    }
  }, [state?.ok, router])

  const isValid = () => {
    if (!name.trim()) return false
    if (sourceType === 'url') return endpointUrl.trim().length > 0
    if (sourceType === 'upload') return !!fileChosen
    return false
  }

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
              action={(formData: FormData) => {
                formData.set('source_type', sourceType)
                startTransition(() => formAction(formData))
              }}
              encType="multipart/form-data"
              className="grid gap-3"
            >
              {/* Name & type */}
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-gray-600">Name</label>
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

              {/* URL or file */}
              {sourceType === 'url' && (
                <div>
                  <label className="text-sm text-gray-600">Endpoint URL *</label>
                  <input
                    name="endpoint_url"
                    value={endpointUrl}
                    onChange={(e) => setEndpointUrl(e.target.value)}
                    className="border rounded-lg px-3 py-2 w-full"
                    placeholder="https://supplier.com/feed.xml"
                    required
                  />
                </div>
              )}
              {sourceType === 'upload' && (
                <div>
                  <label className="text-sm text-gray-600">Upload XML/CSV *</label>
                  <input
                    ref={fileInputRef}
                    name="file"
                    type="file"
                    accept=".xml,.csv,.json"
                    className="border rounded-lg px-3 py-2 w-full"
                    required
                    onChange={(e) => setFileChosen(e.target.files?.[0] ?? null)}
                  />
                </div>
              )}

              {/* Optional fields */}
              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  <label className="text-sm text-gray-600">Schedule</label>
                  <input name="schedule" className="border rounded-lg px-3 py-2 w-full" />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Auth username</label>
                  <input name="auth_username" className="border rounded-lg px-3 py-2 w-full" />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Auth password</label>
                  <input
                    name="auth_password"
                    type="password"
                    className="border rounded-lg px-3 py-2 w-full"
                  />
                </div>
              </div>

              {/* Error */}
              {state?.error && (
                <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
                  {state.error}
                </div>
              )}

              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-3 py-2 border rounded hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isValid() || isPending}
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
