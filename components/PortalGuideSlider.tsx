'use client'

import { useEffect, useState, useRef } from 'react'

interface PortalGuideSliderProps {
  isOpen: boolean
  onClose: () => void
}

// Declare pdfjsLib on window
declare global {
  interface Window {
    pdfjsLib: any
  }
}

export default function PortalGuideSlider({ isOpen, onClose }: PortalGuideSliderProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [pdfImages, setPdfImages] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)
  const pdfUrl = '/How To Guide.pdf'

  useEffect(() => {
    setIsMounted(true)
    // Detect mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent))
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Load PDF.js from CDN and render PDF
  useEffect(() => {
    if (!isOpen || !isMounted) return

    const loadPdfJs = async () => {
      // Check if already loaded
      if (window.pdfjsLib) {
        return window.pdfjsLib
      }

      return new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.min.mjs'
        script.type = 'module'
        
        // For module scripts, we need to use a different approach
        // Let's use the legacy build instead
        const legacyScript = document.createElement('script')
        legacyScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
        legacyScript.onload = () => {
          if (window.pdfjsLib) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
            resolve(window.pdfjsLib)
          } else {
            reject(new Error('PDF.js failed to load'))
          }
        }
        legacyScript.onerror = () => reject(new Error('Failed to load PDF.js script'))
        document.head.appendChild(legacyScript)
      })
    }

    const loadPdf = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const pdfjsLib = await loadPdfJs()
        
        // Load the PDF document
        const loadingTask = pdfjsLib.getDocument(pdfUrl)
        const pdf = await loadingTask.promise
        
        const images: string[] = []
        const scale = isMobile ? 1.5 : 2 // Higher scale for better quality
        
        // Render each page
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const viewport = page.getViewport({ scale })
          
          // Create canvas
          const canvas = document.createElement('canvas')
          const context = canvas.getContext('2d')!
          canvas.height = viewport.height
          canvas.width = viewport.width
          
          // Render page to canvas
          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise
          
          // Convert canvas to image data URL
          images.push(canvas.toDataURL('image/jpeg', 0.9))
        }
        
        setPdfImages(images)
        setLoading(false)
      } catch (err) {
        console.error('Error loading PDF:', err)
        setError('Failed to load PDF. Please try downloading it instead.')
        setLoading(false)
      }
    }

    loadPdf()
  }, [isOpen, isMounted, isMobile])

  // Handle escape key to close
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Track current page on scroll
  useEffect(() => {
    const container = containerRef.current
    if (!container || pdfImages.length === 0) return

    const handleScroll = () => {
      const scrollTop = container.scrollTop
      const containerHeight = container.clientHeight
      const images = container.querySelectorAll('img')
      
      let currentPageNum = 1
      let accumulatedHeight = 0
      
      images.forEach((img, index) => {
        const imgHeight = img.clientHeight + 16 // 16px margin
        if (scrollTop >= accumulatedHeight - containerHeight / 2) {
          currentPageNum = index + 1
        }
        accumulatedHeight += imgHeight
      })
      
      setCurrentPage(currentPageNum)
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [pdfImages])

  if (!isOpen) return null

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = pdfUrl
    link.download = 'Portal Guide.pdf'
    link.click()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header with back button */}
      <div className="flex items-center justify-between gap-2 p-3 sm:p-4 border-b bg-white shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={onClose}
            className="flex items-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm sm:text-base"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-base sm:text-lg font-semibold text-gray-900">Portal Guide</h1>
        </div>
        
        {/* Download button */}
        <button
          onClick={handleDownload}
          className="flex items-center gap-1 px-2 sm:px-3 py-2 text-xs sm:text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          title="Download PDF"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span className="hidden xs:inline">Download</span>
        </button>
      </div>

      {/* PDF Viewer - rendered as images */}
      <div 
        ref={containerRef}
        className="flex-1 w-full overflow-auto bg-gray-200"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-600">Loading Guide...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full p-4">
            <div className="flex flex-col items-center gap-4 text-center">
              <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-600">{error}</p>
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                Download PDF
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center py-4 px-2 sm:px-4">
            {pdfImages.map((imgSrc, index) => (
              <img
                key={index}
                src={imgSrc}
                alt={`Page ${index + 1}`}
                className="w-full max-w-3xl mb-4 shadow-lg rounded bg-white"
                style={{ maxWidth: isMobile ? '100%' : '800px' }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Page indicator */}
      {!loading && !error && pdfImages.length > 0 && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2">
          <div className="bg-black/70 text-white px-4 py-2 rounded-full text-sm">
            Page {currentPage} of {pdfImages.length}
          </div>
        </div>
      )}
    </div>
  )
}
