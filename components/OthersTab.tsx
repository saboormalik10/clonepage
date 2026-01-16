'use client'

import { useState, useEffect } from 'react'
import { useUserId } from '@/hooks/useUserId'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { useVisibilityChange } from '@/hooks/useVisibilityChange'
import AddOthersForm from './AddOthersForm'

interface Item {
  name: string
  description: string
}

interface Category {
  id?: string
  category: string
  items: Item[]
}

export default function OthersTab() {
  const [data, setData] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingRecord, setEditingRecord] = useState<Category | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null)

  const userId = useUserId()
  const isAdmin = useIsAdmin()
  const { refreshTrigger } = useVisibilityChange()

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Only show loading on initial load, not on refreshes
        if (!hasLoaded) {
          setIsLoading(true)
        }
        const { authenticatedFetch } = await import('@/lib/authenticated-fetch')
        const response = await authenticatedFetch('/api/others')
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          console.error('❌ [Others] API error:', response.status, errorData)
          if (response.status === 401) {
            console.error('❌ [Others] Authentication failed - checking localStorage...')
            const { shouldRedirectToLogin } = await import('@/lib/authenticated-fetch')
            if (shouldRedirectToLogin()) {
              window.location.href = '/login'
              return
            } else {
              console.log('✅ [Others] Valid localStorage session, continuing...')
              setData([])
              setIsLoading(false)
              return
            }
          }
          throw new Error(`API error: ${response.status}`)
        }
        
        const responseData = await response.json()
        
        // Handle new response format with data and priceAdjustments
        let othersData = responseData
        if (responseData && typeof responseData === 'object' && 'data' in responseData) {
          othersData = responseData.data
        }
        
        if (Array.isArray(othersData)) {
          setData(othersData)
          setHasLoaded(true)
        } else {
          console.warn('⚠️ [Others] Unexpected data format:', othersData)
          setData([])
          setHasLoaded(true)
        }
      } catch (error) {
        console.error('Error fetching others:', error)
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
      console.log('🔄 [Others] Refreshing data...')
      const { authenticatedFetch } = await import('@/lib/authenticated-fetch')
      const response = await authenticatedFetch('/api/others')
      
      if (!response.ok) {
        throw new Error(`Failed to refresh data: ${response.status}`)
      }
      
      const responseData = await response.json()
      let othersData = responseData
      if (responseData && typeof responseData === 'object' && 'data' in responseData) {
        othersData = responseData.data
      }
      
      if (Array.isArray(othersData)) {
        setData(othersData)
      }
    } catch (error: any) {
      console.error('❌ [Others] Error refreshing data:', error)
      setError('Failed to refresh data')
    }
  }

  const handleAddRecord = async (formData: any) => {
    try {
      console.log('➕ [Others] Adding new record:', formData)
      const { authenticatedFetch } = await import('@/lib/authenticated-fetch')
      const response = await authenticatedFetch('/api/others', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add record')
      }

      const result = await response.json()
      console.log('✅ [Others] Record added successfully:', result)
      
      setSuccess('Category added successfully!')
      setShowAddModal(false)
      await refreshData()
    } catch (error: any) {
      console.error('❌ [Others] Error adding record:', error)
      setError(error.message || 'Failed to add record')
    }
  }

  const handleEditRecord = async (formData: any) => {
    if (!editingRecord?.id) {
      setError('No record selected for editing')
      return
    }

    try {
      console.log('✏️ [Others] Updating record:', formData)
      const { authenticatedFetch } = await import('@/lib/authenticated-fetch')
      const response = await authenticatedFetch('/api/others', {
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
      console.log('✅ [Others] Record updated successfully:', result)
      
      setSuccess('Category updated successfully!')
      setEditingRecord(null)
      await refreshData()
    } catch (error: any) {
      console.error('❌ [Others] Error updating record:', error)
      setError(error.message || 'Failed to update record')
    }
  }

  const handleDeleteRecord = async (recordId: string) => {
    if (!confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
      return
    }

    try {
      setDeletingRecordId(recordId)
      console.log('🗑️ [Others] Deleting record:', recordId)
      const { authenticatedFetch } = await import('@/lib/authenticated-fetch')
      const response = await authenticatedFetch(`/api/others?id=${recordId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete record')
      }

      const result = await response.json()
      console.log('✅ [Others] Record deleted successfully:', result)
      
      setSuccess('Category deleted successfully!')
      await refreshData()
    } catch (error: any) {
      console.error('❌ [Others] Error deleting record:', error)
      setError(error.message || 'Failed to delete record')
    } finally {
      setDeletingRecordId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="opacity-100">
        <div className="flex items-center justify-center p-8">
          <p className="text-charcoal-400">Loading others...</p>
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

      {/* Admin Controls */}
      {isAdmin && (
        <div className="mb-4">
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-gradient-to-r from-gold-400 via-gold-500 to-gold-400 text-black-pure px-4 py-2 rounded-md hover:from-gold-500 hover:via-gold-600 hover:to-gold-500 hover:shadow-[0_6px_25px_rgba(212,175,55,0.7)] focus:outline-none focus:ring-2 focus:ring-gold-500 text-sm font-medium transition-all duration-200"
          >
            Add New Category
          </button>
        </div>
      )}

      <div>
        {data.length === 0 && !isLoading ? (
          <div className="text-center py-8 text-charcoal-400">
            No others categories available
          </div>
        ) : (
          data.map((category: Category, categoryIndex: number) => (
          <div key={categoryIndex} className="flex flex-col mb-4 bg-gradient-to-br from-charcoal-900 to-black-soft rounded-lg border border-charcoal-700 p-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-xs text-charcoal-400 uppercase">Category</span>
                <h2 className="font-body font-medium text-lg my-1 uppercase text-gold-400">
                  {category.category}
                </h2>
              </div>
              {isAdmin && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => setEditingRecord(category)}
                    className="text-gold-400 hover:text-gold-300 text-xs px-2 py-1 border border-gold-400 rounded hover:bg-gold-400/10 hover:shadow-[0_6px_25px_rgba(212,175,55,0.7)] transition-colors"
                    title="Edit category"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => category.id && handleDeleteRecord(category.id)}
                    disabled={deletingRecordId === category.id || !category.id}
                    className="text-red-400 hover:text-red-300 text-xs px-2 py-1 border border-red-400 rounded hover:bg-red-400/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Delete category"
                  >
                    {deletingRecordId === category.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 grid-flow-row md:grid-flow-col md:grid-cols-3 gap-4">
              {category.items.map((item: Item, itemIndex: number) => (
                <div key={itemIndex} className="bg-charcoal-800/50 p-1 font-body text-sm rounded border border-charcoal-700">
                  <h3 className="font-medium bg-gold-400/20 text-gold-400 p-1 rounded-t">
                    {item.name}
                  </h3>
                  <p className="bg-charcoal-900/50 p-1 text-xs text-champagne">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        ))
        )}
      </div>

      {/* Add Record Modal */}
      {showAddModal && (
        <AddOthersForm
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddRecord}
          error={error}
          success={success}
        />
      )}

      {/* Edit Record Modal */}
      {editingRecord && (
        <AddOthersForm
          onClose={() => setEditingRecord(null)}
          onSubmit={handleEditRecord}
          error={error}
          success={success}
          initialData={editingRecord}
          isEditMode={true}
        />
      )}
    </div>
  )
}


