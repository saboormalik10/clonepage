'use client'

import { useState, useEffect } from 'react'
import { useUserId } from '@/hooks/useUserId'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { useVisibilityChange } from '@/hooks/useVisibilityChange'
import AddPRBundleForm from './AddPRBundleForm'

interface Bundle {
  name: string
  retailValue: string
  publications: string[]
}

interface Category {
  id?: string
  category: string
  bundles: Bundle[]
}

export default function PRBundlesTab() {
  const [data, setData] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
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
        setIsLoading(true)
        const { authenticatedFetch } = await import('@/lib/authenticated-fetch')
        const response = await authenticatedFetch('/api/pr-bundles')
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
          console.error('❌ [PR Bundles] API error:', response.status, errorData)
          if (response.status === 401) {
            console.error('❌ [PR Bundles] Authentication failed - checking localStorage...')
            const { shouldRedirectToLogin } = await import('@/lib/authenticated-fetch')
            if (shouldRedirectToLogin()) {
              window.location.href = '/login'
              return
            } else {
              console.log('✅ [PR Bundles] Valid localStorage session, continuing...')
              setData([])
              setIsLoading(false)
              return
            }
          }
          throw new Error(`API error: ${response.status}`)
        }
        
        const responseData = await response.json()
        
        // Handle new response format with data and priceAdjustments
        let bundlesData = responseData
        if (responseData && typeof responseData === 'object' && 'data' in responseData) {
          bundlesData = responseData.data
        }
        
        if (Array.isArray(bundlesData)) {
          setData(bundlesData)
        } else {
          console.warn('⚠️ [PR Bundles] Unexpected data format:', bundlesData)
          setData([])
        }
      } catch (error) {
        console.error('Error fetching PR bundles:', error)
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
      console.log('🔄 [PR Bundles] Refreshing data...')
      const { authenticatedFetch } = await import('@/lib/authenticated-fetch')
      const response = await authenticatedFetch('/api/pr-bundles')
      
      if (!response.ok) {
        throw new Error(`Failed to refresh data: ${response.status}`)
      }
      
      const responseData = await response.json()
      let bundlesData = responseData
      if (responseData && typeof responseData === 'object' && 'data' in responseData) {
        bundlesData = responseData.data
      }
      
      if (Array.isArray(bundlesData)) {
        setData(bundlesData)
      }
    } catch (error: any) {
      console.error('❌ [PR Bundles] Error refreshing data:', error)
      setError('Failed to refresh data')
    }
  }

  const handleAddRecord = async (formData: any) => {
    try {
      console.log('➕ [PR Bundles] Adding new record:', formData)
      const { authenticatedFetch } = await import('@/lib/authenticated-fetch')
      const response = await authenticatedFetch('/api/pr-bundles', {
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
      console.log('✅ [PR Bundles] Record added successfully:', result)
      
      setSuccess('Category added successfully!')
      setShowAddModal(false)
      await refreshData()
    } catch (error: any) {
      console.error('❌ [PR Bundles] Error adding record:', error)
      setError(error.message || 'Failed to add record')
    }
  }

  const handleEditRecord = async (formData: any) => {
    if (!editingRecord?.id) {
      setError('No record selected for editing')
      return
    }

    try {
      console.log('✏️ [PR Bundles] Updating record:', formData)
      const { authenticatedFetch } = await import('@/lib/authenticated-fetch')
      const response = await authenticatedFetch('/api/pr-bundles', {
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
      console.log('✅ [PR Bundles] Record updated successfully:', result)
      
      setSuccess('Category updated successfully!')
      setEditingRecord(null)
      await refreshData()
    } catch (error: any) {
      console.error('❌ [PR Bundles] Error updating record:', error)
      setError(error.message || 'Failed to update record')
    }
  }

  const handleDeleteRecord = async (recordId: string) => {
    if (!confirm('Are you sure you want to delete this category? This action cannot be undone.')) {
      return
    }

    try {
      setDeletingRecordId(recordId)
      console.log('🗑️ [PR Bundles] Deleting record:', recordId)
      const { authenticatedFetch } = await import('@/lib/authenticated-fetch')
      const response = await authenticatedFetch(`/api/pr-bundles?id=${recordId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete record')
      }

      const result = await response.json()
      console.log('✅ [PR Bundles] Record deleted successfully:', result)
      
      setSuccess('Category deleted successfully!')
      await refreshData()
    } catch (error: any) {
      console.error('❌ [PR Bundles] Error deleting record:', error)
      setError(error.message || 'Failed to delete record')
    } finally {
      setDeletingRecordId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="opacity-100">
        <div className="flex items-center justify-center p-8">
          <p className="text-gray-500">Loading PR bundles...</p>
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

      {/* Admin Controls */}
      {isAdmin && (
        <div className="mb-4">
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            Add New Category
          </button>
        </div>
      )}

      <div>
        {data.length === 0 && !isLoading ? (
          <div className="text-center py-8 text-gray-500">
            No PR bundle categories available
          </div>
        ) : (
          data.map((category: Category, categoryIndex: number) => (
          <div key={categoryIndex} className="flex flex-col mb-4">
            <div className="flex justify-between items-center">
              <h2 className="font-body font-medium text-lg my-2 uppercase">
                {category.category}
              </h2>
              {isAdmin && (
                <div className="flex space-x-2">
                  <button
                    onClick={() => setEditingRecord(category)}
                    className="text-blue-600 hover:text-blue-800 text-xs px-2 py-1 border border-blue-600 rounded hover:bg-blue-50"
                    title="Edit category"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => category.id && handleDeleteRecord(category.id)}
                    disabled={deletingRecordId === category.id || !category.id}
                    className="text-red-600 hover:text-red-800 text-xs px-2 py-1 border border-red-600 rounded hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete category"
                  >
                    {deletingRecordId === category.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 grid-flow-row md:grid-flow-col md:grid-cols-3 gap-4">
              {category.bundles.map((bundle: Bundle, bundleIndex: number) => (
                <div key={bundleIndex} className="bg-white p-1 font-body text-sm">
                  <h3 className="font-medium bg-primary/20 text-primary p-1">
                    {bundle.name}
                  </h3>
                  <h3 className="bg-gray-50 p-1">{bundle.retailValue}</h3>
                  <ul className="list-decimal ml-6 mt-2 mb-2">
                    {bundle.publications.map((publication: string, pubIndex: number) => (
                      <li key={pubIndex}>{publication}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))
        )}
      </div>

      {/* Add Record Modal */}
      {showAddModal && (
        <AddPRBundleForm
          onClose={() => setShowAddModal(false)}
          onSubmit={handleAddRecord}
          error={error}
          success={success}
        />
      )}

      {/* Edit Record Modal */}
      {editingRecord && (
        <AddPRBundleForm
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

