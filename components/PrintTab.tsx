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
  const [editingRecord, setEditingRecord] = useState<Category | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const userId = useUserId()
  const isAdmin = useIsAdmin()
  const { refreshTrigger } = useVisibilityChange()

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
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
        } else {
          console.warn('⚠️ [Print] Unexpected data format:', printData)
          setData([])
        }
      } catch (error) {
        console.error('Error fetching print data:', error)
        setData([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [refreshTrigger]) // Re-fetch when tab becomes visible

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
      console.log('🔄 [Print] Refreshing data...')
      const { authenticatedFetch } = await import('@/lib/authenticated-fetch')
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
          <p className="text-gray-500">Loading print data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="opacity-100">
      {/* Error/Success Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          {success}
        </div>
      )}

      <div>
        {data.length === 0 && !isLoading ? (
          <div className="text-center py-8 text-gray-500">
            No print categories available
          </div>
        ) : (
          data.map((category: Category, categoryIndex: number) => (
          <div key={categoryIndex} className="flex flex-col mb-4">
            <div className="flex justify-between items-center">
              <h2 className="font-body font-medium text-lg my-2 uppercase">
                {category.category}
              </h2>
              {isAdmin && (
                <button
                  onClick={() => setEditingRecord(category)}
                  className="text-blue-600 hover:text-blue-800 text-xs px-2 py-1 border border-blue-600 rounded hover:bg-blue-50"
                  title="Edit category"
                >
                  Edit
                </button>
              )}
            </div>
            {category.magazines.map((magazine: Magazine, magIndex: number) => (
              <div key={magIndex} className="flex flex-col font-body mb-3">
                <div className="bg-white p-3">
                  <p className="text-primary font-medium mb-1">
                    <a href={magazine.url} target="_blank" rel="noopener noreferrer">
                      {magazine.name}
                    </a>
                  </p>
                  {magazine.details.map((detail: string, detailIndex: number) => (
                    <p key={detailIndex} className="text-slate-600 text-sm">
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

