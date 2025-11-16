'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-client'

const TABLES = [
  { value: 'publications', label: 'Publications' },
  { value: 'social_posts', label: 'Social Posts' },
  { value: 'digital_tv', label: 'Digital TV' },
  { value: 'best_sellers', label: 'Best Sellers' },
  { value: 'listicles', label: 'Listicles' },
  { value: 'pr_bundles', label: 'PR Bundles' },
  { value: 'print', label: 'Print' },
  { value: 'broadcast_tv', label: 'Broadcast TV' },
  { value: 'others', label: 'Others' },
]

interface Adjustment {
  id: string
  table_name: string
  adjustment_percentage: number
  exact_amount?: number | null
  min_price?: number | null
  max_price?: number | null
  created_at: string
  updated_at: string
}

export default function GlobalPricesPage() {
  const [adjustments, setAdjustments] = useState<Adjustment[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [adjustmentType, setAdjustmentType] = useState<'percentage' | 'exact'>('percentage')
  const [formData, setFormData] = useState({
    table_name: 'publications',
    adjustment_percentage: '',
    exact_amount: '',
    min_price: '',
    max_price: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [processing, setProcessing] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    fetchAdjustments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }

  const fetchAdjustments = async () => {
    try {
      const token = await getAuthToken()
      const response = await fetch('/api/admin/prices/global', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch adjustments')
      }

      const data = await response.json()
      setAdjustments(data.adjustments || [])
    } catch (err: any) {
      console.error('Error fetching adjustments:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleApplyAdjustment = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setProcessing(true)

    try {
      const token = await getAuthToken()
      const response = await fetch('/api/admin/prices/global', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          table_name: formData.table_name,
          adjustment_percentage: adjustmentType === 'percentage' ? parseFloat(formData.adjustment_percentage) : undefined,
          exact_amount: adjustmentType === 'exact' ? parseFloat(formData.exact_amount) : undefined,
          min_price: formData.min_price ? parseFloat(formData.min_price) : null,
          max_price: formData.max_price ? parseFloat(formData.max_price) : null
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to apply adjustment')
      }

      const adjustmentText = adjustmentType === 'exact' 
        ? `$${formData.exact_amount}` 
        : `${formData.adjustment_percentage}%`
      setSuccess(`Successfully applied ${adjustmentText} adjustment to ${TABLES.find(t => t.value === formData.table_name)?.label}`)
      setFormData({ table_name: 'publications', adjustment_percentage: '', exact_amount: '', min_price: '', max_price: '' })
      setAdjustmentType('percentage')
      setShowModal(false)
      
      // Immediately refresh the list
      await fetchAdjustments()
    } catch (err: any) {
      setError(err.message || 'Failed to apply adjustment')
    } finally {
      setProcessing(false)
    }
  }

  const handleRemoveAdjustment = async (adjustmentId: string) => {
    if (!confirm('Are you sure you want to remove this adjustment?')) return

    setError('')
    setSuccess('')
    
    // Optimistic update - remove from UI immediately
    const previousAdjustments = [...adjustments]
    setAdjustments(prev => prev.filter(adj => adj.id !== adjustmentId))

    try {
      const token = await getAuthToken()
      const response = await fetch(`/api/admin/prices/global?id=${adjustmentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (!response.ok) {
        // Revert optimistic update on error
        setAdjustments(previousAdjustments)
        throw new Error(data.error || 'Failed to remove adjustment')
      }

      setSuccess('Adjustment removed successfully!')
      // Refresh to ensure consistency
      await fetchAdjustments()
    } catch (err: any) {
      setError(err.message || 'Failed to remove adjustment')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Global Price Management</h1>
          <p className="mt-2 text-sm text-gray-600">
            Adjust prices globally across all tables. You can add multiple adjustments per table.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Apply Global Adjustment
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-800">{error}</div>
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-md bg-green-50 p-4">
          <div className="text-sm text-green-800">{success}</div>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {TABLES.map((table) => {
            const tableAdjustments = adjustments.filter(a => a.table_name === table.value)
            return (
              <li key={table.value}>
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-gray-900">{table.label}</p>
                    <span className="text-xs text-gray-500">
                      {tableAdjustments.length} adjustment{tableAdjustments.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  {tableAdjustments.length > 0 ? (
                    <div className="space-y-2">
                      {tableAdjustments.map((adjustment) => (
                        <div key={adjustment.id} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                          <div className="flex-1">
                            <p className="text-sm text-gray-700">
                              {adjustment.exact_amount !== null && adjustment.exact_amount !== undefined
                                ? `$${adjustment.exact_amount} (exact amount)`
                                : `${adjustment.adjustment_percentage > 0 ? '+' : ''}${adjustment.adjustment_percentage}%`
                              }
                              {(adjustment.min_price || adjustment.max_price) && (
                                <span className="ml-2 text-xs text-gray-500">
                                  (Range: ${adjustment.min_price || '0'} - ${adjustment.max_price || 'unlimited'})
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              Created: {new Date(adjustment.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <button
                            onClick={() => handleRemoveAdjustment(adjustment.id)}
                            className="ml-4 text-red-600 hover:text-red-900 text-sm font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">No adjustments applied</p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {showModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowModal(false)}></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleApplyAdjustment}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Apply Global Price Adjustment</h3>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="table_name" className="block text-sm font-medium text-gray-700">
                        Table
                      </label>
                      <select
                        id="table_name"
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        value={formData.table_name}
                        onChange={(e) => setFormData({ ...formData, table_name: e.target.value })}
                      >
                        {TABLES.map((table) => (
                          <option key={table.value} value={table.value}>{table.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Adjustment Type
                      </label>
                      <div className="flex space-x-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="adjustmentType"
                            value="percentage"
                            checked={adjustmentType === 'percentage'}
                            onChange={(e) => setAdjustmentType(e.target.value as 'percentage' | 'exact')}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700">Percentage</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="adjustmentType"
                            value="exact"
                            checked={adjustmentType === 'exact'}
                            onChange={(e) => setAdjustmentType(e.target.value as 'percentage' | 'exact')}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700">Exact Amount ($)</span>
                        </label>
                      </div>
                    </div>
                    {adjustmentType === 'percentage' ? (
                      <div>
                        <label htmlFor="adjustment_percentage" className="block text-sm font-medium text-gray-700">
                          Adjustment Percentage
                        </label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                          <input
                            type="number"
                            id="adjustment_percentage"
                            required={adjustmentType === 'percentage'}
                            step="0.01"
                            min="-100"
                            max="1000"
                            className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 pr-8 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            placeholder="e.g., 10 for +10%, -5 for -5%"
                            value={formData.adjustment_percentage}
                            onChange={(e) => setFormData({ ...formData, adjustment_percentage: e.target.value })}
                          />
                          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 sm:text-sm">%</span>
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-gray-500">
                          Positive values increase prices, negative values decrease prices
                        </p>
                      </div>
                    ) : (
                      <div>
                        <label htmlFor="exact_amount" className="block text-sm font-medium text-gray-700">
                          Exact Amount ($)
                        </label>
                        <div className="mt-1 relative rounded-md shadow-sm">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 text-sm">$</span>
                          </div>
                          <input
                            type="number"
                            id="exact_amount"
                            required={adjustmentType === 'exact'}
                            step="0.01"
                            min="0"
                            className="block w-full pl-7 pr-3 border border-gray-300 rounded-md shadow-sm py-2 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="e.g., 1000"
                            value={formData.exact_amount}
                            onChange={(e) => setFormData({ ...formData, exact_amount: e.target.value })}
                          />
                        </div>
                        <p className="mt-2 text-sm text-gray-500">
                          This will replace the price with the exact amount instead of applying a percentage
                        </p>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Price Range (Optional)
                      </label>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="min_price" className="block text-xs text-gray-500 mb-1">
                            Min Price
                          </label>
                          <div className="relative rounded-md shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <span className="text-gray-500 text-sm">$</span>
                            </div>
                            <input
                              type="number"
                              id="min_price"
                              step="0.01"
                              min="0"
                              className="block w-full pl-7 pr-3 border border-gray-300 rounded-md shadow-sm py-2 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                              placeholder="0"
                              value={formData.min_price}
                              onChange={(e) => setFormData({ ...formData, min_price: e.target.value })}
                            />
                          </div>
                        </div>
                        <div>
                          <label htmlFor="max_price" className="block text-xs text-gray-500 mb-1">
                            Max Price
                          </label>
                          <div className="relative rounded-md shadow-sm">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <span className="text-gray-500 text-sm">$</span>
                            </div>
                            <input
                              type="number"
                              id="max_price"
                              step="0.01"
                              min="0"
                              className="block w-full pl-7 pr-3 border border-gray-300 rounded-md shadow-sm py-2 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                              placeholder="Unlimited"
                              value={formData.max_price}
                              onChange={(e) => setFormData({ ...formData, max_price: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        Adjustment will only apply to prices within this range. Leave empty for no limit.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={processing}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    {processing ? 'Applying...' : 'Apply Adjustment'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    disabled={processing}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}






