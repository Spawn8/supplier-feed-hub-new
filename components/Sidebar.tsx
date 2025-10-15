'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import WorkspaceFormModal from '@/components/WorkspaceFormModal'
import WorkspaceFetcher from '@/components/WorkspaceFetcher'
import WorkspaceSelector from '@/components/WorkspaceSelector'
import { useWorkspace } from '@/lib/workspaceContext'

interface Workspace {
  id: string
  name: string
  slug: string
  description?: string
  created_at: string
  updated_at: string
  user_role: string
}

export default function Sidebar({
  logo,
}: {
  logo: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { activeWorkspaceId, setActiveWorkspaceId, workspaces, setWorkspaces } = useWorkspace()
  const [mounted, setMounted] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showIntegrationsMenu, setShowIntegrationsMenu] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  async function switchWorkspace(id: string) {
    const res = await fetch('/api/switch-workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace_id: id }),
    })
    if (!res.ok) return
    setActiveWorkspaceId(id)
    router.refresh()
  }

  const nav = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/suppliers', label: 'Suppliers' },
    { href: '/products', label: 'Products' },
    { href: '/categories', label: 'Categories' },
    { href: '/fields', label: 'Fields' },
    { href: '/exports', label: 'Exports' },
    { 
      label: 'Integrations', 
      submenu: [
        { href: '/integrations/woocommerce', label: 'WooCommerce' }
      ]
    },
    { href: '/workspaces', label: 'Workspaces' },
  ]

  return (
    <>
      <WorkspaceFetcher onWorkspacesLoaded={setWorkspaces} />
      <aside className="w-64 bg-white border-r border-gray-200 h-screen flex flex-col shadow-sm fixed left-0 top-0" suppressHydrationWarning={true}>
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">SF</span>
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">Supplier Feed Hub</h1>
              <p className="text-xs text-gray-500">Feed Management</p>
            </div>
          </div>

          {/* Workspace Selector */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">Current Workspace</label>
            <WorkspaceSelector />
          </div>
        </div>

        {/* Navigation - Only show if workspace is selected */}
        {activeWorkspaceId && (
          <nav className="flex-1 p-4 overflow-y-auto">
            <ul className="space-y-1">
              {nav.map((item, index) => {
                // Handle submenu items (like Integrations)
                if (item.submenu) {
                  const isIntegrationsActive = item.submenu.some(subItem => pathname === subItem.href)
                  return (
                    <li key={item.label}>
                      <button
                        onClick={() => setShowIntegrationsMenu(!showIntegrationsMenu)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isIntegrationsActive 
                            ? 'bg-blue-50 text-blue-700' 
                            : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                        }`}
                      >
                        <span className="flex items-center gap-3">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          {item.label}
                        </span>
                        <svg 
                          className={`w-4 h-4 transition-transform ${showIntegrationsMenu ? 'rotate-90' : ''}`}
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      {showIntegrationsMenu && (
                        <ul className="ml-6 mt-1 space-y-1">
                          {item.submenu.map((subItem) => {
                            const subActive = pathname === subItem.href
                            return (
                              <li key={subItem.href}>
                                <Link
                                  href={subItem.href}
                                  className={`flex items-center px-3 py-2 rounded-lg text-sm transition-colors ${
                                    subActive 
                                      ? 'bg-blue-50 text-blue-700 font-medium' 
                                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                  }`}
                                >
                                  {subItem.label}
                                </Link>
                              </li>
                            )
                          })}
                        </ul>
                      )}
                    </li>
                  )
                }

                // Handle regular navigation items
                const active = pathname === item.href
                return (
                  <li key={item.href || index}>
                    <Link
                      href={item.href}
                      className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        active 
                          ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700' 
                          : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        {item.href === '/dashboard' && (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z" />
                          </svg>
                        )}
                        {item.href === '/suppliers' && (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                        )}
                        {item.href === '/fields' && (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        )}
                        {item.href === '/products' && (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V7a2 2 0 00-2-2h-4l-2-2-2 2H6a2 2 0 00-2 2v6m16 0v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4m16 0H4" />
                          </svg>
                        )}
                        {item.href === '/categories' && (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                        )}
                        {item.href === '/exports' && (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        )}
                        {item.href === '/workspaces' && (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        )}
                        {item.label}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>
        )}

        {/* User Menu */}
        <div className="p-4 border-t border-gray-200 mt-auto flex-shrink-0">
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-gray-900">User Account</p>
                <p className="text-xs text-gray-500">Manage your account</p>
              </div>
              <svg 
                className={`w-4 h-4 text-gray-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showUserMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                <div className="py-1">
                  <Link
                    href="/account"
                    className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Account Settings
                  </Link>
                  <form action="/auth/signout" method="post" className="block">
                    <button
                      type="submit"
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 text-left"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign Out
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>

        <WorkspaceFormModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
        onSuccess={(workspace) => {
          setActiveWorkspaceId(workspace.id)
          setShowCreateModal(false)
          router.refresh()
        }}
        />
      </aside>
    </>
  )
}