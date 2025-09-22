'use client'

import { useState, useEffect, useRef, useActionState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
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
  const [state, formAction] = useActionState(createSupplierAction, initial)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (state?.ok) {
      setOpen(false)
      setName(''); setEndpointUrl(''); setSchedule(''); setAuthUsername(''); setAuthPassword('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      router.refresh()
    }
  }, [state?.ok, router])

  const valid = name.trim().length > 0 && ((sourceType === 'url' && endpointUrl.trim()) || sourceType === 'upload')

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        + Add Supplier
      </Button>

      <Modal
        open={open}
        title="Add a new supplier"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              form="supplier-create-form"
              type="submit"
              variant="primary"
              disabled={!valid || isPending}
            >
              {isPending ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <form
          id="supplier-create-form"
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
            <div className="field">
              <label className="label">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Supplier name" required />
            </div>

            <div className="field">
              <label className="label">Source Type</label>
              <Select value={sourceType} onChange={(e) => setSourceType(e.target.value as 'url' | 'upload')}>
                <option value="url">URL</option>
                <option value="upload">Upload file</option>
              </Select>
            </div>
          </div>

          {sourceType === 'url' && (
            <div className="field">
              <label className="label">Endpoint URL</label>
              <Input value={endpointUrl} onChange={(e) => setEndpointUrl(e.target.value)} placeholder="https://example.com/feed.xml" />
            </div>
          )}

          {sourceType === 'upload' && (
            <div className="field">
              <label className="label">Upload file (XML/CSV/JSON)</label>
              <Input ref={fileInputRef} name="file" type="file" accept=".xml,.csv,.json,application/xml,text/csv,application/json" />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="field">
              <label className="label">Schedule</label>
              <Input value={schedule} onChange={(e) => setSchedule(e.target.value)} placeholder="e.g. hourly | 0 3 * * *" />
            </div>
            <div className="field">
              <label className="label">Auth username</label>
              <Input value={authUsername} onChange={(e) => setAuthUsername(e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Auth password</label>
              <Input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} />
            </div>
          </div>

          {state?.error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {state.error}
            </div>
          )}
        </form>
      </Modal>
    </>
  )
}
