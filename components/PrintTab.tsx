'use client'

import { useState, useEffect } from 'react'
import { useUserId } from '@/hooks/useUserId'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { useVisibilityChange } from '@/hooks/useVisibilityChange'
import EditPrintForm from './EditPrintForm'

interface Magazine {
  name: string
  url: string
  details: string[]
}

interface Category {
  id?: string
  category: string
  magazines: Magazine[]
}

export default function PrintTab() {
  const [data, setData] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [editingRecord, setEditingRecord] = useState<Category | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const userId = useUserId()
  const isAdmin = useIsAdmin()
  const { refreshTrigger } = useVisibilityChange()

  // Debug logging for admin status
  useEffect(() => {
    console.log('🔍 [PrintTab] Admin status:', isAdmin, 'User ID:', userId)
  }, [isAdmin, userId])

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Only show loading on initial load, not on refreshes
        if (!hasLoaded) {
          setIsLoading(true)
        }
        const { authenticatedFetch } = await import('@/lib/authenticated-fetch')
        const response = await authenticatedFetch('/api/print')
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          console.error('❌ [Print] API error:', response.status, errorData)
          if (response.status === 401) {
            console.error('❌ [Print] Authentication failed - checking localStorage...')
            const { shouldRedirectToLogin } = await import('@/lib/authenticated-fetch')
            if (shouldRedirectToLogin()) {
              window.location.href = '/login'
              return
            } else {
              console.log('✅ [Print] Valid localStorage session, continuing...')
              setData([])
              setIsLoading(false)
              return
            }
          }
          throw new Error(`API error: ${response.status}`)
        }
        
        const responseData = await response.json()
        
        // Handle new response format with data and priceAdjustments
        let printData = responseData
        if (responseData && typeof responseData === 'object' && 'data' in responseData) {
          printData = responseData.data
        }
        
        if (Array.isArray(printData)) {
          setData(printData)
          setHasLoaded(true)
        } else {
          console.warn('⚠️ [Print] Unexpected data format:', printData)
          setData([])
          setHasLoaded(true)
        }
      } catch (error) {
        console.error('Error fetching print data:', error)
        setData([])
        setHasLoaded(true)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [refreshTrigger, hasLoaded]) // Re-fetch when tab becomes visible

  // Clear messages after 3 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('')
        setSuccess('')
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [error, success])

  const refreshData = async () => {
    try {
      console.log('🔄 [Print] Refreshing data from database...')
      const { authenticatedFetch } = await import('@/lib/authenticated-fetch')
      // Always fetch fresh data from database (no cache)
      const response = await authenticatedFetch('/api/print')
      
      if (!response.ok) {
        throw new Error(`Failed to refresh data: ${response.status}`)
      }
      
      const responseData = await response.json()
      let printData = responseData
      if (responseData && typeof responseData === 'object' && 'data' in responseData) {
        printData = responseData.data
      }
      
      if (Array.isArray(printData)) {
        setData(printData)
      }
    } catch (error: any) {
      console.error('❌ [Print] Error refreshing data:', error)
      setError('Failed to refresh data')
    }
  }

  const handleEditRecord = async (formData: any) => {
    if (!editingRecord?.id) {
      setError('No record selected for editing')
      return
    }

    try {
      console.log('✏️ [Print] Updating record:', formData)
      const { authenticatedFetch } = await import('@/lib/authenticated-fetch')
      const response = await authenticatedFetch('/api/print', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...formData, id: editingRecord.id }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update record')
      }

      const result = await response.json()
      console.log('✅ [Print] Record updated successfully:', result)
      
      setSuccess('Category updated successfully!')
      setEditingRecord(null)
      await refreshData()
    } catch (error: any) {
      console.error('❌ [Print] Error updating record:', error)
      setError(error.message || 'Failed to update record')
    }
  }

  if (isLoading) {
    return (
      <div className="opacity-100">
        <div className="flex items-center justify-center p-8">
          <p className="text-charcoal-400">Loading print data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="opacity-100">
      {/* Error/Success Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 text-red-400 rounded">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-900/30 border border-green-500/50 text-green-400 rounded">
          {success}
        </div>
      )}

      <div>
        {data.length === 0 && !isLoading ? (
          <div className="text-center py-8 text-charcoal-400">
            No print categories available
          </div>
        ) : (
          data.map((category: Category, categoryIndex: number) => (
          <div key={categoryIndex} className="flex flex-col mb-6">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-ui text-xs font-semibold tracking-wider uppercase text-gold-400">
                {category.category}
              </h2>
              {isAdmin && (
                <button
                  onClick={() => setEditingRecord(category)}
                  className="text-gold-400 hover:text-gold-300 text-xs px-3 py-1.5 border border-gold-400 hover:bg-gold-400/10 hover:shadow-[0_6px_25px_rgba(212,175,55,0.7)] transition-all duration-300"
                  title="Edit category"
                >
                  Edit
                </button>
              )}
            </div>
            {category.magazines.map((magazine: Magazine, magIndex: number) => (
              <div key={magIndex} className="flex flex-col font-body mb-3">
                <div className="bg-gradient-to-br from-charcoal-900 to-black-soft border border-charcoal-700 p-4 hover:border-charcoal-600 transition-all duration-300">
                  <p className="text-gold-400 font-medium mb-2">
                    <a href={magazine.url} target="_blank" rel="noopener noreferrer" className="hover:text-gold-300 transition-colors">
                      {magazine.name}
                    </a>
                  </p>
                  {magazine.details.map((detail: string, detailIndex: number) => (
                    <p key={detailIndex} className="text-charcoal-300 text-sm">
                      {detail}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))
        )}
      </div>

      {/* Edit Record Modal */}
      {editingRecord && (
        <EditPrintForm
          onClose={() => setEditingRecord(null)}
          onSubmit={handleEditRecord}
          error={error}
          success={success}
          initialData={editingRecord}
        />
      )}
    </div>
  )
}

