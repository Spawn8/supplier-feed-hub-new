'use client'

import { useState, ReactNode, useRef, useEffect } from 'react'

interface HoverTooltipProps {
  content: string
  children: ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
  useFixed?: boolean
}

export default function HoverTooltip({ 
  content, 
  children, 
  position = 'top',
  delay = 300,
  useFixed = false
}: HoverTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  const updateTooltipPosition = () => {
    if (useFixed && containerRef.current && isVisible) {
      const rect = containerRef.current.getBoundingClientRect()
      setTooltipPosition({
        top: rect.top - 40, // Adjust for tooltip height
        left: rect.left + rect.width / 2
      })
    }
  }

  useEffect(() => {
    if (useFixed && isVisible) {
      // Update position immediately when tooltip becomes visible
      updateTooltipPosition()
      
      const handleScroll = () => updateTooltipPosition()
      const handleResize = () => updateTooltipPosition()
      
      window.addEventListener('scroll', handleScroll, true)
      window.addEventListener('resize', handleResize)
      
      return () => {
        window.removeEventListener('scroll', handleScroll, true)
        window.removeEventListener('resize', handleResize)
      }
    }
  }, [useFixed, isVisible])

  const showTooltip = () => {
    const id = setTimeout(() => {
      setIsVisible(true)
      // Position will be updated by useEffect when isVisible becomes true
    }, delay)
    setTimeoutId(id)
  }

  const hideTooltip = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      setTimeoutId(null)
    }
    setIsVisible(false)
  }

  const getPositionClasses = () => {
    switch (position) {
      case 'top':
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2'
      case 'bottom':
        return 'top-full left-1/2 transform -translate-x-1/2 mt-2'
      case 'left':
        return 'right-full top-1/2 transform -translate-y-1/2 mr-2'
      case 'right':
        return 'left-full top-1/2 transform -translate-y-1/2 ml-2'
      default:
        return 'bottom-full left-1/2 transform -translate-x-1/2 mb-2'
    }
  }

  const getArrowClasses = () => {
    switch (position) {
      case 'top':
        return 'top-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-900'
      case 'bottom':
        return 'bottom-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-gray-900'
      case 'left':
        return 'left-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-gray-900'
      case 'right':
        return 'right-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-gray-900'
      default:
        return 'top-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-900'
    }
  }

  return (
    <div 
      ref={containerRef}
      className="relative inline-block"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
    >
      {children}
      
      {isVisible && (
        <div 
          className={useFixed ? 'fixed z-[9999]' : `absolute z-[9999] ${getPositionClasses()}`}
          style={useFixed ? {
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            transform: 'translateX(-50%)'
          } : {}}
        >
          <div className="bg-gray-900 text-white text-xs rounded-lg px-3 py-2 whitespace-nowrap shadow-xl border border-gray-700">
            {content}
          </div>
          {!useFixed && <div className={`absolute w-0 h-0 border-4 ${getArrowClasses()}`}></div>}
        </div>
      )}
    </div>
  )
}
