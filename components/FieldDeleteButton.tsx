'use client'

import { useState } from 'react'

interface FieldDeleteButtonProps {
  fieldId: string
  fieldName: string
  onSuccess?: () => void
}

export default function FieldDeleteButton({ fieldId, fieldName, onSuccess }: FieldDeleteButtonProps) {
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleDelete = async () => {
    setLoading(true)

    try {
      const response = await fetch(`/api/fields/${fieldId}/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete field')
      }

      onSuccess?.()
    } catch (err) {
      console.error('Error deleting field:', err)
      alert(err instanceof Error ? err.message : 'Failed to delete field')
    } finally {
      setLoading(false)
      setShowConfirm(false)
    }
  }

  if (showConfirm) {
    return (
      <div className="flex items-center space-x-2">
        <button
          onClick={handleDelete}
          disabled={loading}
          className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {loading ? 'Deleting...' : 'Confirm'}
        </button>
        <button
          onClick={() => setShowConfirm(false)}
          disabled={loading}
          className="text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setShowConfirm(true)}
      className="text-red-600 hover:text-red-900 text-sm"
      title={`Delete ${fieldName}`}
    >
      Delete
    </button>
  )
}