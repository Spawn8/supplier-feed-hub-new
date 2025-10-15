'use client'

export default function CategoriesPageSkeleton() {
  return (
    <div className="categories-page min-h-screen bg-gray-50">
      <div className="categories-container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Skeleton */}
        <div className="categories-header mb-8">
          <div className="categories-header-content flex items-center justify-between">
            <div className="categories-header-info">
              <div className="animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-48 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-96"></div>
              </div>
            </div>
            <div className="animate-pulse flex gap-3">
              <div className="h-10 bg-gray-200 rounded w-32"></div>
              <div className="h-10 bg-gray-200 rounded w-28"></div>
            </div>
          </div>
        </div>

        {/* Categories Content Skeleton */}
        <div className="categories-content mt-8">
          {/* Header Row Skeleton */}
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <div className="animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-40"></div>
              </div>
              <div className="animate-pulse flex items-center gap-2">
                <div className="h-4 bg-gray-200 rounded w-4"></div>
                <div className="h-4 bg-gray-200 rounded w-24"></div>
              </div>
            </div>
          </div>

          {/* Table Header Skeleton */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 flex-1">
                <div className="animate-pulse flex items-center space-x-2 w-16">
                  <div className="h-4 bg-gray-200 rounded w-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-4"></div>
                </div>
                <div className="animate-pulse flex-1">
                  <div className="h-4 bg-gray-200 rounded w-32"></div>
                </div>
                <div className="animate-pulse w-32">
                  <div className="h-4 bg-gray-200 rounded w-16"></div>
                </div>
              </div>
              <div className="animate-pulse flex items-center space-x-3 ml-4">
                <div className="w-16">
                  <div className="h-4 bg-gray-200 rounded w-16"></div>
                </div>
                <div className="w-20">
                  <div className="h-4 bg-gray-200 rounded w-16"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Category Cards Skeleton */}
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1">
                    {/* Number Column */}
                    <div className="flex items-center space-x-2 w-16">
                      <div className="h-4 bg-gray-200 rounded w-6"></div>
                      <div className="h-4 bg-gray-200 rounded w-4"></div>
                    </div>

                    {/* Category Name Column */}
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>

                    {/* Type Column */}
                    <div className="w-32">
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-gray-200 rounded-full"></div>
                        <div className="h-4 bg-gray-200 rounded w-16 ml-2"></div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
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
      </div>
    </div>
  )
}
