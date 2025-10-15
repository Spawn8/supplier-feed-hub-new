'use client'

import { ReactNode } from 'react'
import Button from './Button'

export default function Modal({
  isOpen,
  title,
  children,
  onClose,
  footer,
}: {
  isOpen: boolean
  title?: string
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
}) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 bg-gray-500/30 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          {title && <h2 className="text-lg font-semibold mb-4 text-gray-900">{title}</h2>}
          <div>{children}</div>
          <div className="mt-6 flex justify-end gap-2">
            {footer ?? (
              <Button onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
