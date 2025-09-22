'use client'

import { SelectHTMLAttributes, forwardRef } from 'react'
import clsx from 'clsx'

type Props = SelectHTMLAttributes<HTMLSelectElement>

const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { className, children, ...rest },
  ref
) {
  return (
    <select ref={ref} className={clsx('select', className)} {...rest}>
      {children}
    </select>
  )
})

export default Select
