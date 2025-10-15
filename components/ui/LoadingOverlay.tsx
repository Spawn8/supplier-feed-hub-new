'use client'

interface LoadingOverlayProps {
  isVisible: boolean
  message?: string
}

export default function LoadingOverlay({ isVisible, message = "Working… Please wait" }: LoadingOverlayProps) {
  if (!isVisible) return null

  return (
    <>
      <div className="fixed left-0 right-0 top-0 bottom-0 m-0 p-0 bg-gray-500/30 backdrop-blur-sm z-[1000]" />
      <div className="fixed left-0 right-0 top-0 bottom-0 m-0 p-0 z-[1001] flex items-center justify-center">
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-6 py-4 flex flex-col items-center text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <span className="text-sm text-gray-700">{message}</span>
        </div>
      </div>
    </>
  )
}
