'use client'

import { useState } from 'react'

interface QuickActionsProps {
  onAction?: (action: string) => void
}

export default function QuickActions({ onAction }: QuickActionsProps) {
  const [loading, setLoading] = useState<string | null>(null)

  const actions = [
    {
      id: 'add_supplier',
      title: 'Add Supplier',
      description: 'Connect a new supplier feed',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      ),
      color: 'bg-blue-500 hover:bg-blue-600',
      href: '/suppliers/new'
    },
    {
      id: 'create_field',
      title: 'Create Field',
      description: 'Define a new custom field',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      color: 'bg-green-500 hover:bg-green-600',
      href: '/fields'
    },
    {
      id: 'generate_export',
      title: 'Generate Export',
      description: 'Create a new export profile',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      color: 'bg-purple-500 hover:bg-purple-600',
      href: '/exports'
    },
    {
      id: 'sync_all',
      title: 'Sync All',
      description: 'Run sync for all suppliers',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
      color: 'bg-orange-500 hover:bg-orange-600',
      action: 'sync_all'
    }
  ]

  const handleAction = async (action: any) => {
    if (action.href) {
      window.location.href = action.href
      return
    }

    if (action.action) {
      setLoading(action.id)
      try {
        if (action.action === 'sync_all') {
          const response = await fetch('/api/suppliers/sync-all', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          })

          if (!response.ok) {
            const data = await response.json()
            throw new Error(data.error || 'Failed to sync all suppliers')
          }

          // Show success message
          alert('Sync started for all suppliers')
        }

        onAction?.(action.action)
      } catch (error) {
        console.error('Error performing action:', error)
        alert('Failed to perform action')
      } finally {
        setLoading(null)
      }
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={() => handleAction(action)}
            disabled={loading === action.id}
            className={`${action.color} text-white p-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                {loading === action.id ? (
                  <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  action.icon
                )}
              </div>
              <div className="text-left">
                <p className="font-medium">{action.title}</p>
                <p className="text-sm opacity-90">{action.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}