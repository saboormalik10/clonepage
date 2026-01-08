'use client'

import { useEffect } from 'react'

interface PortalGuideSliderProps {
  isOpen: boolean
  onClose: () => void
}

export default function PortalGuideSlider({ isOpen, onClose }: PortalGuideSliderProps) {
  // Handle escape key to close
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header with back button */}
      <div className="flex items-center gap-4 p-4 border-b bg-white shadow-sm">
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <h1 className="text-lg font-semibold text-gray-900">Portal Guide</h1>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 w-full">
        <iframe
          src="/How To Guide.pdf"
          className="w-full h-full border-0"
          title="Portal Guide PDF"
        />
      </div>
    </div>
  )
}
