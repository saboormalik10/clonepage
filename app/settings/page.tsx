'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import Header from '@/components/Header'

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
  user_id: string
  table_name: string
  adjustment_percentage: number
  exact_amount?: number | null
  min_price?: number | null
  max_price?: number | null
  created_at: string
}

type SettingsTab = 'price-adjustment' | 'password-reset'

export default function UserSettingsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<SettingsTab>('price-adjustment')
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
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  
  const supabase = createClient()

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      const token = await getAuthToken()

      const response = await fetch('/api/user/price-adjustments', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch adjustments')
      }

      setAdjustments(data.adjustments || [])
    } catch (err: any) {
      console.error('Error fetching data:', err)
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

    // Store form values before clearing
    const tableName = formData.table_name
    const adjustmentPercentage = adjustmentType === 'percentage' ? parseFloat(formData.adjustment_percentage) : 0
    
    // Validate that percentage is positive
    if (adjustmentType === 'percentage' && (isNaN(adjustmentPercentage) || adjustmentPercentage < 0)) {
      setError('Percentage adjustment must be a positive number')
      setProcessing(false)
      return
    }
    
    const exactAmount = adjustmentType === 'exact' ? parseFloat(formData.exact_amount) : null
    const minPrice = formData.min_price ? parseFloat(formData.min_price) : null
    const maxPrice = formData.max_price ? parseFloat(formData.max_price) : null
    const tableLabel = TABLES.find(t => t.value === tableName)?.label || tableName
    const adjustmentText = adjustmentType === 'exact' 
      ? `$${formData.exact_amount}` 
      : `${formData.adjustment_percentage}%`

    // Store previous state for rollback
    const previousAdjustments = [...adjustments]
    
    // Create temporary adjustment for optimistic update
    const tempId = `temp-${Date.now()}`
    const tempAdjustment: Adjustment = {
      id: tempId,
      user_id: '', // Will be set by server
      table_name: tableName,
      adjustment_percentage: adjustmentPercentage,
      exact_amount: exactAmount,
      min_price: minPrice,
      max_price: maxPrice,
      created_at: new Date().toISOString()
    }

    // Optimistic update - add to UI immediately
    setAdjustments(prev => [tempAdjustment, ...prev])
    setFormData({ table_name: 'publications', adjustment_percentage: '', exact_amount: '', min_price: '', max_price: '' })
    setAdjustmentType('percentage')
    setShowModal(false)

    try {
      const token = await getAuthToken()
      const response = await fetch('/api/user/price-adjustments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          table_name: tableName,
          adjustment_percentage: adjustmentType === 'percentage' ? adjustmentPercentage : undefined,
          exact_amount: adjustmentType === 'exact' ? exactAmount : undefined,
          min_price: minPrice,
          max_price: maxPrice
        })
      })

      const data = await response.json()

      if (!response.ok) {
        // Revert optimistic update on error
        setAdjustments(previousAdjustments)
        throw new Error(data.error || 'Failed to apply adjustment')
      }

      // Replace temporary adjustment with real one from server
      if (data.data && data.data[0]) {
        setAdjustments(prev => prev.map(adj => 
          adj.id === tempId ? data.data[0] : adj
        ))
      } else {
        // If server didn't return data, refresh the list
        await fetchData()
      }

      setSuccess(`Successfully applied ${adjustmentText} adjustment to ${tableLabel}`)
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
    const removedAdjustment = adjustments.find(adj => adj.id === adjustmentId)
    setAdjustments(prev => prev.filter(adj => adj.id !== adjustmentId))

    try {
      const token = await getAuthToken()
      const response = await fetch(`/api/user/price-adjustments?id=${adjustmentId}`, {
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
      // No need to refresh - optimistic update already handled it
    } catch (err: any) {
      setError(err.message || 'Failed to remove adjustment')
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(false)

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required')
      return
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirm password do not match')
      return
    }

    if (currentPassword === newPassword) {
      setPasswordError('New password must be different from current password')
      return
    }

    setPasswordLoading(true)

    try {
      // Check if user is logged in
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || !session.user.email) {
        setPasswordError('You must be logged in to change your password')
        setPasswordLoading(false)
        return
      }

      // Verify current password by attempting to sign in with it
      // This creates a temporary session to verify the password
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password: currentPassword,
      })

      if (verifyError) {
        setPasswordError('Current password is incorrect')
        setPasswordLoading(false)
        return
      }

      // Now update the password (user is authenticated after sign in)
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (updateError) {
        setPasswordError(updateError.message || 'Failed to update password')
        setPasswordLoading(false)
        return
      }

      setPasswordSuccess(true)
      setPasswordLoading(false)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      // Show success message for 5 seconds
      setTimeout(() => {
        setPasswordSuccess(false)
      }, 5000)
    } catch (err: any) {
      setPasswordError(err.message || 'An unexpected error occurred')
      setPasswordLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="__variable_a59c88">
      <Header />
      <main className="w-full p-2 lg:w-full lg:p-4 lg:mx-auto xl:p-[2] 2xl:w-[1650px]">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-4">
            <button
              onClick={() => router.push('/')}
              className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4"
            >
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Main Page
            </button>
          </div>
          
          <div className="flex gap-6">
            {/* Sidebar Navigation */}
            <div className="w-64 flex-shrink-0">
              <div className="bg-white shadow rounded-lg">
                <nav className="p-2">
                  <button
                    onClick={() => setActiveTab('price-adjustment')}
                    className={`w-full text-left px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                      activeTab === 'price-adjustment'
                        ? 'bg-indigo-50 text-indigo-700 border-l-4 border-indigo-600'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Price Adjustment
                  </button>
                  <button
                    onClick={() => setActiveTab('password-reset')}
                    className={`w-full text-left px-4 py-3 rounded-md text-sm font-medium transition-colors ${
                      activeTab === 'password-reset'
                        ? 'bg-indigo-50 text-indigo-700 border-l-4 border-indigo-600'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Password Reset
                  </button>
                </nav>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1">
              {activeTab === 'price-adjustment' && (
                <div>
                  <div className="mb-8 flex justify-between items-center">
                    <div>
                      <h1 className="text-3xl font-bold text-gray-900">Price Adjustments</h1>
                      <p className="mt-2 text-sm text-gray-600">
                        Manage your personal price adjustments. You can add multiple adjustments per category.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowModal(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      Add Adjustment
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
                      {adjustments.length > 0 ? (
                        adjustments.map((adjustment) => (
                          <li key={adjustment.id}>
                            <div className="px-4 py-4 sm:px-6 flex items-center justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">
                                  {TABLES.find(t => t.value === adjustment.table_name)?.label || adjustment.table_name}
                                </p>
                                <p className="mt-1 text-sm text-gray-500">
                                  <span className="font-medium">
                                    {adjustment.exact_amount !== null && adjustment.exact_amount !== undefined
                                      ? `$${adjustment.exact_amount} (exact amount)`
                                      : `${adjustment.adjustment_percentage > 0 ? '+' : ''}${adjustment.adjustment_percentage}%`
                                    }
                                  </span>
                                  {(adjustment.min_price || adjustment.max_price) && (
                                    <span className="ml-2 text-xs text-gray-400">
                                      (Range: ${adjustment.min_price || '0'} - ${adjustment.max_price || 'unlimited'})
                                    </span>
                                  )}
                                  <span className="ml-2 text-xs text-gray-400">
                                    (Created: {new Date(adjustment.created_at).toLocaleDateString()})
                                  </span>
                                </p>
                              </div>
                              <button
                                onClick={() => handleRemoveAdjustment(adjustment.id)}
                                className="ml-4 text-red-600 hover:text-red-900 text-sm font-medium"
                              >
                                Remove
                              </button>
                            </div>
                          </li>
                        ))
                      ) : (
                        <li>
                          <div className="px-4 py-8 text-center text-sm text-gray-500">
                            No price adjustments found. Click &quot;Add Adjustment&quot; to create one.
                          </div>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )}

              {activeTab === 'password-reset' && (
                <div>
                  <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900">Password Reset</h1>
                    <p className="mt-2 text-sm text-gray-600">
                      Change your account password. Make sure to use a strong password.
                    </p>
                  </div>

                  <div className="bg-white shadow rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                      <h2 className="text-lg font-medium text-gray-900 mb-4">Change Password</h2>
                      
                      {passwordError && (
                        <div className="mb-4 rounded-md bg-red-50 p-4">
                          <div className="flex">
                            <div className="flex-shrink-0">
                              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-red-800">{passwordError}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {passwordSuccess && (
                        <div className="mb-4 rounded-md bg-green-50 p-4">
                          <div className="flex">
                            <div className="flex-shrink-0">
                              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-green-800">
                                Password updated successfully!
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <form onSubmit={handlePasswordChange} className="space-y-6">
                        <div>
                          <label htmlFor="current-password" className="block text-sm font-medium text-gray-700">
                            Current Password
                          </label>
                          <div className="mt-1">
                            <input
                              id="current-password"
                              name="current-password"
                              type="password"
                              required
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              placeholder="Enter your current password"
                            />
                          </div>
                        </div>

                        <div>
                          <label htmlFor="new-password" className="block text-sm font-medium text-gray-700">
                            New Password
                          </label>
                          <div className="mt-1">
                            <input
                              id="new-password"
                              name="new-password"
                              type="password"
                              required
                              minLength={6}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              placeholder="Enter your new password (min 6 characters)"
                            />
                          </div>
                          <p className="mt-2 text-sm text-gray-500">
                            Password must be at least 6 characters long
                          </p>
                        </div>

                        <div>
                          <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700">
                            Confirm New Password
                          </label>
                          <div className="mt-1">
                            <input
                              id="confirm-password"
                              name="confirm-password"
                              type="password"
                              required
                              minLength={6}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              placeholder="Confirm your new password"
                            />
                          </div>
                        </div>

                        <div>
                          <button
                            type="submit"
                            disabled={passwordLoading}
                            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {passwordLoading ? 'Updating...' : 'Update Password'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {showModal && (
            <div className="fixed z-10 inset-0 overflow-y-auto">
              <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowModal(false)}></div>
                <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                  <form onSubmit={handleApplyAdjustment}>
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                      <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Add Price Adjustment</h3>
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="table_name" className="block text-sm font-medium text-gray-700">
                            Category
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
                                min="0"
                                max="1000"
                                className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 pr-8 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                placeholder="e.g., 10 for +10%"
                                value={formData.adjustment_percentage}
                                onChange={(e) => {
                                  const value = e.target.value
                                  // Only allow positive numbers or empty string
                                  if (value === '' || (parseFloat(value) >= 0 && !isNaN(parseFloat(value)))) {
                                    setFormData({ ...formData, adjustment_percentage: value })
                                  }
                                }}
                              />
                              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <span className="text-gray-500 sm:text-sm">%</span>
                              </div>
                            </div>
                            <p className="mt-2 text-sm text-gray-500">
                              Only positive percentages are allowed. This adjustment will be applied on top of global adjustments (if any)
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
      </main>
    </div>
  )
}

