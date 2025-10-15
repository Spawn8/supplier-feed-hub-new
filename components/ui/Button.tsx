'use client'

import { ButtonHTMLAttributes, forwardRef } from 'react'
import clsx from 'clsx'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'danger' | 'outline'
  size?: 'sm' | 'md' | 'lg'
}

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { className, variant = 'default', size = 'md', ...rest },
  ref
) {
  const sizeClasses = 
    size === 'sm'
      ? 'px-3 py-1.5 text-sm'
      : size === 'lg'
      ? 'px-6 py-3 text-lg'
      : 'px-4 py-2 text-base'

  const baseClasses = `${sizeClasses} rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2`
  
  const variantClasses = 
    variant === 'primary'
      ? 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
      : variant === 'danger'
      ? 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500'
      : variant === 'outline'
      ? 'bg-white text-gray-700 hover:bg-gray-50 focus:ring-gray-500 border border-gray-300'
      : 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500 border border-gray-300'

  return <button ref={ref} className={clsx(baseClasses, variantClasses, className)} {...rest} />
})

export default Button
