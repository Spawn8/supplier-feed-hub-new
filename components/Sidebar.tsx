'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import WorkspaceFormModal from '@/components/WorkspaceFormModal'

export default function Sidebar({
  logo,
  workspaces,
  activeWsId,
}: {
  logo: string
  workspaces: { id: string; name: string }[]
  activeWsId: string | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [ws, setWs] = useState<string | null>(activeWsId ?? null)

  useEffect(() => {
    setWs(activeWsId ?? null)
  }, [activeWsId])

  async function switchWorkspace(id: string) {
    const res = await fetch('/api/switch-workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: id }),
    })
    if (!res.ok) return
    setWs(id)
    router.refresh()
  }

  const nav = [
    { href: '/', label: 'Dashboard' },
    { href: '/suppliers', label: 'Suppliers' },
    { href: '/workspaces', label: 'Workspaces' },
  ]

  return (
    <aside className="w-64 bg-gray-900 text-gray-100 min-h-screen flex flex-col">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <img src={logo} alt="logo" className="h-6 w-6" />
          <span className="font-semibold">Supplier Feed Hub</span>
        </div>

        <div className="mt-4">
          <label className="block text-xs text-gray-400">Workspace</label>
          <select
            className="mt-1 w-full bg-gray-800 text-gray-100 border border-gray-700 rounded px-2 py-1"
            value={ws ?? ''}
            onChange={(e) => {
              const id = e.target.value
              if (id) switchWorkspace(id)
            }}
          >
            <option value="" disabled>
              Select workspace…
            </option>
            {workspaces?.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          <div className="mt-2">
            <WorkspaceFormModal
              buttonLabel="Add workspace"
              onCreated={(id) => {
                setWs(id)
                router.refresh()
              }}
            />
          </div>
        </div>
      </div>

      <nav className="flex-1 p-2">
        <ul className="space-y-1">
          {nav.map((item) => {
            const active = pathname === item.href
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`block px-3 py-2 rounded ${
                    active ? 'bg-gray-800 text-white' : 'hover:bg-gray-800'
                  }`}
                >
                  {item.label}
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
    </aside>
  )
}
