'use client'

import { useEffect, useState, useTransition } from 'react'
import Button from '@/components/ui/Button'
import FieldDeleteButton from '@/components/FieldDeleteButton'

type Field = {
  id: string
  name: string
  key: string
  datatype: string
  sort_order: number
}

export default function FieldsSortableTable() {
  const [fields, setFields] = useState<Field[]>([])
  const [dragId, setDragId] = useState<string | null>(null)
  const [isPending, start] = useTransition()

  async function load() {
    const res = await fetch('/api/fields/list', { cache: 'no-store' })
    if (!res.ok) return
    const j = await res.json().catch(()=>({ fields: [] }))
    setFields(j.fields || [])
  }

  useEffect(()=>{ load() }, [])

  function onDragStart(e: React.DragEvent<HTMLTableRowElement>, id: string) {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  function onDragOver(e: React.DragEvent<HTMLTableRowElement>) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  function onDrop(e: React.DragEvent<HTMLTableRowElement>, targetId: string) {
    e.preventDefault()
    const sourceId = dragId || e.dataTransfer.getData('text/plain')
    if (!sourceId || sourceId === targetId) return
    const sourceIndex = fields.findIndex(f => f.id === sourceId)
    const targetIndex = fields.findIndex(f => f.id === targetId)
    if (sourceIndex === -1 || targetIndex === -1) return
    const updated = fields.slice()
    const [moved] = updated.splice(sourceIndex, 1)
    updated.splice(targetIndex, 0, moved)
    setFields(updated)
  }

  async function persistOrder() {
    start(async ()=>{
      const ids = fields.map(f => f.id)
      await fetch('/api/fields/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      await load()
    })
  }

  return (
    <div className="rounded border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-2 text-left w-8">#</th>
            <th className="px-3 py-2 text-left">Name</th>
            <th className="px-3 py-2 text-left">Key</th>
            <th className="px-3 py-2 text-left">Type</th>
            <th className="px-3 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {fields.map((f, idx) => (
            <tr
              key={f.id}
              draggable
              onDragStart={(e)=>onDragStart(e, f.id)}
              onDragOver={onDragOver}
              onDrop={(e)=>onDrop(e, f.id)}
              className="border-t hover:bg-gray-50 cursor-grab"
            >
              <td className="px-3 py-2 align-middle text-gray-400">{idx+1}</td>
              <td className="px-3 py-2 align-middle">{f.name}</td>
              <td className="px-3 py-2 align-middle font-mono text-xs">{f.key}</td>
              <td className="px-3 py-2 align-middle">{f.datatype}</td>
              <td className="px-3 py-2 align-middle text-right">
                <FieldDeleteButton id={f.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-3 flex items-center justify-between bg-gray-50 border-t">
        <div className="text-xs text-gray-500">Drag rows to reorder. Order is saved when you click “Save Order”.</div>
        <Button onClick={persistOrder} disabled={isPending}>
          {isPending ? 'Saving…' : 'Save Order'}
        </Button>
      </div>
    </div>
  )
}
