'use client'

import { useState, useTransition } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import { useRouter } from 'next/navigation'

export default function FieldFormModal() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [key, setKey] = useState('')
  const [datatype, setDatatype] = useState<'text' | 'number' | 'bool' | 'date' | 'json'>('text')
  const [error, setError] = useState<string | null>(null)
  const [isPending, start] = useTransition()

  return (
    <>
      <Button onClick={()=>setOpen(true)}>Add Field</Button>
      <Modal open={open} onClose={()=>setOpen(false)} title="Add Field">
        <form
          className="space-y-4"
          onSubmit={(e)=>{
            e.preventDefault()
            setError(null)
            start(async ()=>{
              const res = await fetch('/api/fields/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, key, datatype }),
              })
              if (!res.ok) {
                const j = await res.json().catch(()=>({}))
                setError(j?.error || 'Failed to create field')
                return
              }
              setOpen(false)
              setName('')
              setKey('')
              setDatatype('text')
              router.refresh()
            })
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Display Name</label>
              <Input value={name} onChange={(e)=>setName(e.target.value)} placeholder="e.g., Title" />
            </div>
            <div>
              <label className="label">Key</label>
              <Input value={key} onChange={(e)=>setKey(e.target.value)} placeholder="e.g., title" />
            </div>
            <div>
              <label className="label">Data Type</label>
              <Select value={datatype} onChange={(e)=>setDatatype(e.target.value as any)}>
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="bool">Boolean</option>
                <option value="date">Date</option>
                <option value="json">JSON</option>
              </Select>
            </div>
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
