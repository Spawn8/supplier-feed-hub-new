'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function Sidebar({
  logo,
  workspaces,
  activeWsId
}: {
  logo: string
  workspaces: { id: string; name: string }[]
  activeWsId: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [ws, setWs] = useState(activeWsId ?? '')

  // Keep local state in sync if server-side active changes (e.g., after refresh)
  useEffect(() => {
    setWs(activeWsId ?? '')
  }, [activeWsId])

  async function handleSwitch(id: string) {
    setWs(id)
    await fetch('/api/switch-workspace', {
      method: 'POST',
      body: JSON.stringify({ workspace_id: id }),
      headers: { 'Content-Type': 'application/json' }
    })
    router.refresh()
  }

  const [open, setOpen] = useState(false)
  const [newWs, setNewWs] = useState('')

  async function createWorkspace(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    fd.set('name', newWs)
    const res = await fetch('/api/create-workspace', { method: 'POST', body: fd })
    const j = await res.json().catch(() => ({}))
    setOpen(false)
    setNewWs('')

    // The route sets the cookie; update local state so the dropdown reflects it immediately
    if (j?.id) {
      setWs(j.id)
    }
    router.refresh()
  }

  const nav = [
    { href: '/', label: 'Dashboard' },
    { href: '/suppliers', label: 'Suppliers' },
    { href: '/workspaces', label: 'Workspaces' }
  ]

  return (
    <aside className="w-64 bg-gray-900 text-gray-100 flex flex-col min-h-screen">
      <div className="h-16 flex items-center justify-center border-b border-gray-800">
        <img src={logo} alt="Logo" className="h-8" />
      </div>

      <div className="p-4 border-b border-gray-800">
        <label className="text-xs text-gray-400 mb-1 block">Workspace</label>
        <select
          value={ws}
          onChange={(e) => handleSwitch(e.target.value)}
          className="w-full bg-gray-800 text-gray-100 rounded px-2 py-1 text-sm"
        >
          {/* Placeholder when no active workspace yet */}
          {(!ws || ws === '') && <option value="">— Select workspace —</option>}
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>

        <button
          onClick={() => setOpen(true)}
          className="mt-3 w-full text-sm bg-blue-600 hover:bg-blue-500 rounded px-3 py-1.5"
        >
          + New Workspace
        </button>
      </div>

      <nav className="flex-1 p-2">
        <ul className="space-y-1">
          {nav.map((n) => {
            const active = pathname === n.href
            return (
              <li key={n.href}>
                <Link
                  href={n.href}
                  className={`block px-3 py-2 rounded ${active ? 'bg-gray-700' : 'hover:bg-gray-800'}`}
                >
                  {n.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-gray-800 text-sm">
        <form action="/auth/signout" method="post">
          <button className="w-full text-left px-3 py-2 rounded hover:bg-gray-800">Sign out</button>
        </form>
      </div>

      {open && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
          <div className="bg-white text-gray-900 rounded-lg shadow-lg w-96 p-6">
            <h2 className="text-lg font-semibold mb-4">Create a new workspace</h2>
            <form onSubmit={createWorkspace} className="space-y-3">
              <input
                value={newWs}
                onChange={(e) => setNewWs(e.target.value)}
                placeholder="Workspace name"
                className="border rounded px-3 py-2 w-full"
                required
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 border rounded">
                  Cancel
                </button>
                <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  )
}
