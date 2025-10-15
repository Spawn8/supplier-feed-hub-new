'use client'

import { useState, useEffect, useActionState, useTransition } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { updateSupplierAction, type UpdateSupplierState } from '@/app/(dashboard)/actions/supplierActions'

type Supplier = {
  id: string
  name: string
  uid_source_key?: string | null
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

  useEffect(() => { if (state?.ok) setOpen(false) }, [state?.ok])

  const valid =
    name.trim().length > 0 &&
    ((sourceType === 'url' && endpointUrl.trim()) || sourceType === 'upload')

  return (
    <>
      <Button onClick={() => setOpen(true)}>Settings</Button>

      <Modal
        open={open}
        title="Supplier settings"
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              form={`supplier-edit-form-${supplier.id}`}
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
          id={`supplier-edit-form-${supplier.id}`}
          action={(fd: FormData) => {
            fd.set('id', supplier.id)
            fd.set('source_type', sourceType)
            fd.set('name', name.trim())
            fd.set('endpoint_url', endpointUrl.trim())
            fd.set('schedule', schedule.trim())
            fd.set('auth_username', authUsername.trim())
            fd.set('auth_password', authPassword.trim())
            const input = document.getElementById(`edit-file-input-${supplier.id}`) as HTMLInputElement | null
            const file = input?.files?.[0]
            if (file) fd.set('file', file)
            startTransition(() => formAction(fd))
          }}
          className="grid gap-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="field">
              <label className="label">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="field">
              <label className="label">Source Type</label>
              <Select value={sourceType} onChange={(e) => setSourceType(e.target.value as 'url' | 'upload')}>
                <option value="url">URL</option>
                <option value="upload">Upload file</option>
              </Select>
            </div>
          </div>

          {/* UID source (locked after first import) */}
          <div className="field">
            <label className="label">UID source {supplier.uid_source_key ? '(locked)' : '(required)'}</label>
            <Input 
              value={supplier.uid_source_key || ''} 
              readOnly={!!supplier.uid_source_key} 
              disabled={!!supplier.uid_source_key}
              placeholder={supplier.uid_source_key ? '' : 'Set in supplier wizard'}
            />
            {supplier.uid_source_key && (
              <p className="text-xs text-gray-500 mt-1">
                Cannot be changed after first successful import
              </p>
            )}
          </div>

          {sourceType === 'url' && (
            <div className="field">
              <label className="label">Endpoint URL</label>
              <Input value={endpointUrl} onChange={(e) => setEndpointUrl(e.target.value)} placeholder="https://…" />
            </div>
          )}

          {sourceType === 'upload' && (
            <div className="field">
              <label className="label">Replace file (optional)</label>
              <Input id={`edit-file-input-${supplier.id}`} type="file" accept=".xml,.csv,.json,application/xml,text/csv,application/json" />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="field">
              <label className="label">Schedule</label>
              <Input
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                placeholder="e.g. hourly | 0 3 * * *"
              />
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
