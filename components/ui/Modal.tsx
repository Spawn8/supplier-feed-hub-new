'use client'

import { ReactNode } from 'react'
import Button from './Button'

export default function Modal({
  open,
  title,
  children,
  onClose,
  footer,
}: {
  open: boolean
  title?: string
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
}) {
  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {title && <h2 className="text-lg font-semibold mb-4">{title}</h2>}
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
  )
}
