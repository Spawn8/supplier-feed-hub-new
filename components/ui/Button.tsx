'use client'

import { ButtonHTMLAttributes, forwardRef } from 'react'
import clsx from 'clsx'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'danger'
}

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = 'default', ...rest },
  ref
) {
  const base =
    variant === 'primary'
      ? 'btn-primary'
      : variant === 'danger'
      ? 'btn-danger'
      : 'btn'

  return <button ref={ref} className={clsx(base, className)} {...rest} />
})

export default Button
