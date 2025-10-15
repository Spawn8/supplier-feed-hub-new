'use client'

interface SkeletonLoaderProps {
  type?: 'page' | 'card' | 'table' | 'list'
  count?: number
}

export default function SkeletonLoader({ type = 'page', count = 1 }: SkeletonLoaderProps) {
  if (type === 'page') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center" suppressHydrationWarning={true}>
        <div className="animate-pulse">
          <div className="h-32 w-32 bg-gray-200 rounded-full"></div>
        </div>
      </div>
    )
  }

  if (type === 'card') {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-6"></div>
        <div className="space-y-3">
          {[...Array(count)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  if (type === 'table') {
    return (
      <div className="animate-pulse">
        {/* Header skeleton */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 flex-1">
              <div className="h-4 bg-gray-200 rounded w-16"></div>
              <div className="h-4 bg-gray-200 rounded flex-1"></div>
              <div className="h-4 bg-gray-200 rounded w-32"></div>
            </div>
            <div className="flex items-center space-x-3 ml-4">
              <div className="h-4 bg-gray-200 rounded w-16"></div>
              <div className="h-4 bg-gray-200 rounded w-20"></div>
            </div>
          </div>
        </div>
        
        {/* Rows skeleton */}
        <div className="space-y-3">
          {[...Array(count)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 flex-1">
                  <div className="flex items-center space-x-2 w-16">
                    <div className="h-4 bg-gray-200 rounded w-6"></div>
                    <div className="h-4 bg-gray-200 rounded w-4"></div>
                  </div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                  <div className="w-32">
                    <div className="h-6 bg-gray-200 rounded w-20 mb-2"></div>
                    <div className="flex space-x-1">
                      <div className="h-4 bg-gray-200 rounded w-12"></div>
                      <div className="h-4 bg-gray-200 rounded w-16"></div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3 ml-4">
                  <div className="w-16 flex justify-center">
                    <div className="h-6 bg-gray-200 rounded w-11"></div>
                  </div>
                  <div className="w-20 flex items-center justify-center space-x-2">
                    <div className="h-8 bg-gray-200 rounded w-8"></div>
                    <div className="h-8 bg-gray-200 rounded w-8"></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (type === 'list') {
    return (
      <div className="animate-pulse">
        <div className="space-y-3">
          {[...Array(count)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 flex-1">
                  <div className="h-4 bg-gray-200 rounded w-6"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                  <div className="h-6 bg-gray-200 rounded w-20"></div>
                </div>
                <div className="flex items-center space-x-3 ml-4">
                  <div className="h-6 bg-gray-200 rounded w-11"></div>
                  <div className="flex items-center space-x-2">
                    <div className="h-8 bg-gray-200 rounded w-8"></div>
                    <div className="h-8 bg-gray-200 rounded w-8"></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return null
}
