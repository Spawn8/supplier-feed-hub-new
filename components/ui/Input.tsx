'use client'

import { InputHTMLAttributes, forwardRef } from 'react'
import clsx from 'clsx'

type Props = InputHTMLAttributes<HTMLInputElement>

const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { className, ...rest },
  ref
) {
  return <input ref={ref} className={clsx('input', className)} {...rest} />
})

export default Input
