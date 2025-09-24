'use client'

import Button from '@/components/ui/Button'

export default function ConfirmSubmitButton({
  label,
  confirmText = 'Delete this supplier? This cannot be undone.',
  variant = 'danger',
}: {
  label: string
  confirmText?: string
  variant?: any
}) {
  return (
    <Button
      type="submit"
      variant={variant}
      onClick={(e) => {
        if (!confirm(confirmText)) {
          e.preventDefault()
        }
      }}
    >
      {label}
    </Button>
  )
}
