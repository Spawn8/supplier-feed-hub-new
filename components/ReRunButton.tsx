'use client'

import { useState } from 'react'

interface ReRunButtonProps {
  supplierId: string
  onSuccess?: () => void
}

export default function ReRunButton({ supplierId, onSuccess }: ReRunButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleReRun = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/suppliers/${supplierId}/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to sync supplier')
      }

      onSuccess?.()
    } catch (err) {
      console.error('Error syncing supplier:', err)
      setError(err instanceof Error ? err.message : 'Failed to sync supplier')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={handleReRun}
        disabled={loading}
        className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {loading ? (
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        )}
      </button>

      {error && (
        <div className="absolute top-8 left-0 bg-red-100 border border-red-200 rounded-lg p-2 text-xs text-red-600 whitespace-nowrap z-10">
          {error}
        </div>
      )}
    </div>
  )
}