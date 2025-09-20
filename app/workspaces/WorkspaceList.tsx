'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Workspace = {
  id: string
  name: string
}

export default function WorkspaceList({ workspaces }: { workspaces: Workspace[] }) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  async function handleUpdate(id: string) {
    const res = await fetch('/api/workspaces', {
      method: 'PUT',
      body: JSON.stringify({ id, name: editName }),
      headers: { 'Content-Type': 'application/json' },
    })
    if (res.ok) {
      setEditingId(null)
      setEditName('')
      router.refresh()
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this workspace?')) return
    const res = await fetch('/api/workspaces', {
      method: 'DELETE',
      body: JSON.stringify({ id }),
      headers: { 'Content-Type': 'application/json' },
    })
    if (res.ok) router.refresh()
  }

  if (!workspaces || workspaces.length === 0) {
    return <div className="text-gray-600">No workspaces yet.</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2 pr-3">Name</th>
            <th className="py-2 pr-3">ID</th>
            <th className="py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {workspaces.map((w) => (
            <tr key={w.id} className="border-b last:border-0">
              <td className="py-2 pr-3">
                {editingId === w.id ? (
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="border rounded px-2 py-1 text-sm"
                  />
                ) : (
                  w.name
                )}
              </td>
              <td className="py-2 pr-3 font-mono text-xs">{w.id}</td>
              <td className="py-2 flex gap-2">
                {editingId === w.id ? (
                  <>
                    <button
                      onClick={() => handleUpdate(w.id)}
                      className="px-2 py-1 bg-blue-600 text-white rounded text-xs"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-2 py-1 border rounded text-xs"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        setEditingId(w.id)
                        setEditName(w.name)
                      }}
                      className="px-2 py-1 border rounded text-xs"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(w.id)}
                      className="px-2 py-1 border rounded text-xs text-red-600"
                    >
                      Delete
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
