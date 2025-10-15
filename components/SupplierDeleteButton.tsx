'use client'

import { useState } from 'react'
import HoverTooltip from './ui/HoverTooltip'

interface SupplierDeleteButtonProps {
  supplierId: string
  supplierName: string
  onSuccess?: () => void
}

export default function SupplierDeleteButton({ supplierId, supplierName, onSuccess }: SupplierDeleteButtonProps) {
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleDelete = async () => {
    setLoading(true)

    try {
      const response = await fetch(`/api/suppliers/delete?id=${supplierId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete supplier')
      }

      onSuccess?.()
    } catch (err) {
      console.error('Error deleting supplier:', err)
      alert(err instanceof Error ? err.message : 'Failed to delete supplier')
    } finally {
      setLoading(false)
      setShowConfirm(false)
    }
  }

  return (
    <div className="relative">
      <HoverTooltip content="Delete supplier" useFixed={true}>
        <button
          onClick={() => setShowConfirm(!showConfirm)}
          className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </HoverTooltip>
      
      {showConfirm && (
        <>
          {/* Transparent overlay background */}
          <div className="fixed inset-0 bg-gray-500 opacity-30 z-[9998]" />
          
          {/* Delete popup */}
          <div 
            className="absolute -right-2 top-0 mt-8 w-80 bg-gray-900 border border-gray-700 rounded-lg shadow-xl z-[9999] p-4"
          >
          <div className="text-sm text-white mb-2 font-medium text-left">
            Are you sure?
          </div>
          <div className="text-xs text-gray-300 mb-3 leading-relaxed text-left whitespace-normal word-wrap break-words max-w-full">
            This will permanently delete "<span className="font-medium text-white">{supplierName}</span>" and all its imported feeds. This action cannot be undone.
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDelete}
              disabled={loading}
              className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? 'Deleting...' : 'Delete Permanently'}
            </button>
            <button
              onClick={() => setShowConfirm(false)}
              disabled={loading}
              className="px-3 py-1 bg-gray-600 text-white text-xs rounded hover:bg-gray-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              Cancel
            </button>
          </div>
          {/* Arrow pointing up */}
          <div className="absolute -top-1 right-4 w-2 h-2 bg-gray-900 border-l border-t border-gray-700 transform rotate-45"></div>
        </div>
        </>
      )}
    </div>
  )
}