'use client'

import { useEffect, useState } from 'react'

interface PortalGuideSliderProps {
  isOpen: boolean
  onClose: () => void
}

export default function PortalGuideSlider({ isOpen, onClose }: PortalGuideSliderProps) {
  const [isMobile, setIsMobile] = useState(false)
  const pdfUrl = '/How To Guide.pdf'

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

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

  // Get full URL for Google Docs Viewer
  const getFullPdfUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}${pdfUrl}`
    }
    return pdfUrl
  }

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = pdfUrl
    link.download = 'Portal Guide.pdf'
    link.click()
  }

  const handleOpenInNewTab = () => {
    window.open(pdfUrl, '_blank')
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header with back button */}
      <div className="flex items-center justify-between gap-4 p-4 border-b bg-white shadow-sm">
        <div className="flex items-center gap-4">
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
        
        {/* Mobile action buttons */}
        {isMobile && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenInNewTab}
              className="flex items-center gap-1 px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              title="Open in new tab"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              <span className="hidden sm:inline">Open</span>
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              title="Download PDF"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span className="hidden sm:inline">Download</span>
            </button>
          </div>
        )}
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 w-full overflow-hidden">
        {isMobile ? (
          // Mobile: Use Google Docs Viewer for better PDF rendering
          <iframe
            src={`https://docs.google.com/viewer?url=${encodeURIComponent(getFullPdfUrl())}&embedded=true`}
            className="w-full h-full border-0"
            title="Portal Guide PDF"
            style={{ minHeight: 'calc(100vh - 80px)' }}
          />
        ) : (
          // Desktop: Use native PDF viewer
          <iframe
            src={pdfUrl}
            className="w-full h-full border-0"
            title="Portal Guide PDF"
          />
        )}
      </div>
    </div>
  )
}
