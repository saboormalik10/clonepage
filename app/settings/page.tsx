'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-client'
import Header from '@/components/Header'
import { useUserProfile } from '@/hooks/useUserProfile'
import Image from 'next/image'

// Email that should not have access to settings
const RESTRICTED_EMAIL = 'wholesale@hotshot.press'

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

type SettingsTab = 'price-adjustment' | 'password-reset' | 'brand-settings'

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
  const [removingAdjustmentId, setRemovingAdjustmentId] = useState<string | null>(null)
  const [checkingAccess, setCheckingAccess] = useState(true)
  
  // Brand settings state
  const [brandName, setBrandName] = useState('')
  const [brandLogo, setBrandLogo] = useState('')
  const [brandLogoPreview, setBrandLogoPreview] = useState<string | null>(null)
  const [brandLoading, setBrandLoading] = useState(false)
  const [brandError, setBrandError] = useState<string | null>(null)
  const [brandSuccess, setBrandSuccess] = useState(false)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [logoUploadError, setLogoUploadError] = useState('')
  const logoFileInputRef = useRef<HTMLInputElement>(null)
  
  const supabase = createClient()
  const { profile, loading: profileLoading } = useUserProfile()

  // Check if user has access to settings page
  useEffect(() => {
    const checkAccess = async () => {
      // Wait for profile to load before checking
      if (profileLoading) {
        return
      }
      
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const userEmail = session?.user?.email?.toLowerCase()
        const profileEmail = profile?.email?.toLowerCase()
        
        if (userEmail === RESTRICTED_EMAIL.toLowerCase() || profileEmail === RESTRICTED_EMAIL.toLowerCase()) {
          // Redirect to home page if user is restricted
          router.push('/')
          return
        }
      } catch (error) {
        console.error('Error checking access:', error)
      } finally {
        setCheckingAccess(false)
      }
    }
    
    checkAccess()
  }, [supabase, router, profile, profileLoading])

  // Load brand settings from profile
  useEffect(() => {
    if (profile) {
      setBrandName(profile.brand_name || '')
      setBrandLogo(profile.brand_logo || '')
      setBrandLogoPreview(profile.brand_logo || null)
    }
  }, [profile])

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
    setRemovingAdjustmentId(adjustmentId)

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
        throw new Error(data.error || 'Failed to remove adjustment')
      }

      // Remove from UI only after successful deletion
      setAdjustments(prev => prev.filter(adj => adj.id !== adjustmentId))
      setSuccess('Adjustment removed successfully!')
    } catch (err: any) {
      setError(err.message || 'Failed to remove adjustment')
    } finally {
      setRemovingAdjustmentId(null)
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

  // Brand logo upload handler
  const handleBrandLogoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setLogoUploadError('')
    setIsUploadingLogo(true)
    
    try {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
      if (!allowedTypes.includes(file.type)) {
        setLogoUploadError('Invalid file type. Only images are allowed.')
        setIsUploadingLogo(false)
        return
      }
      
      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024 // 5MB
      if (file.size > maxSize) {
        setLogoUploadError('File size exceeds 5MB limit')
        setIsUploadingLogo(false)
        return
      }
      
      // Show preview
      const reader = new FileReader()
      reader.onloadend = () => setBrandLogoPreview(reader.result as string)
      reader.readAsDataURL(file)
      
      // Prepare form data for upload
      const uploadFormData = new FormData()
      uploadFormData.append('file', file)
      
      const token = await getAuthToken()
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout
      
      let response: Response
      try {
        response = await fetch('/api/user/upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: uploadFormData,
          signal: controller.signal
        })
        clearTimeout(timeoutId)
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        if (fetchError.name === 'AbortError') {
          throw new Error('Upload timeout. Please try again with a smaller file.')
        }
        throw fetchError
      }
      
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload image')
      }
      
      if (!data.publicUrl) {
        throw new Error('Upload succeeded but no URL returned')
      }
      
      // Store the public URL
      setBrandLogo(data.publicUrl)
      setBrandLogoPreview(data.publicUrl)
    } catch (err: any) {
      setLogoUploadError(err.message || 'Failed to upload image')
      setBrandLogoPreview(brandLogo || null) // Revert to previous
      if (logoFileInputRef.current) {
        logoFileInputRef.current.value = ''
      }
    } finally {
      setIsUploadingLogo(false)
    }
  }, [brandLogo])

  // Save brand settings handler
  const handleSaveBrandSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setBrandError(null)
    setBrandSuccess(false)
    setBrandLoading(true)

    try {
      const token = await getAuthToken()
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          brand_name: brandName,
          brand_logo: brandLogo
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update brand settings')
      }

      setBrandSuccess(true)
      
      // Reload the page to reflect changes in the header
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (err: any) {
      setBrandError(err.message || 'An unexpected error occurred')
    } finally {
      setBrandLoading(false)
    }
  }

  // Remove brand logo handler
  const handleRemoveBrandLogo = () => {
    setBrandLogo('')
    setBrandLogoPreview(null)
    if (logoFileInputRef.current) {
      logoFileInputRef.current.value = ''
    }
  }

  if (checkingAccess || loading) {
    return (
      <div className="min-h-screen bg-black-rich flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-400"></div>
      </div>
    )
  }

  return (
    <div className="__variable_a59c88 min-h-screen bg-black-rich">
      <Header />
      <main className="w-full p-2 lg:w-full lg:p-4 lg:mx-auto xl:p-[2] 2xl:w-[1650px]">
        <div className="px-2 sm:px-4 py-4 sm:py-6">
          <div className="mb-4">
            <button
              onClick={() => router.push('/')}
              className="inline-flex items-center text-sm text-charcoal-300 hover:text-gold-400 transition-colors mb-4"
            >
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-ivory">Back to Main Page</span>
            </button>
          </div>
          
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
            {/* Sidebar Navigation - Mobile: Horizontal tabs, Desktop: Vertical sidebar */}
            <div className="w-full lg:w-64 lg:flex-shrink-0">
              <div className="bg-charcoal-800 border border-charcoal-700 shadow-lg rounded-lg">
                <nav className="p-2 flex lg:flex-col">
                  <button
                    onClick={() => setActiveTab('price-adjustment')}
                    className={`flex-1 lg:w-full text-center lg:text-left px-4 py-3 rounded-md text-sm font-medium transition-all duration-300 ${
                      activeTab === 'price-adjustment'
                        ? 'bg-gold-400/10 text-gold-400 border-b-2 lg:border-b-0 lg:border-l-4 border-gold-400'
                        : 'text-charcoal-300 hover:bg-charcoal-700 hover:text-ivory'
                    }`}
                  >
                    Price Adjustment
                  </button>
                  <button
                    onClick={() => setActiveTab('brand-settings')}
                    className={`flex-1 lg:w-full text-center lg:text-left px-4 py-3 rounded-md text-sm font-medium transition-all duration-300 ${
                      activeTab === 'brand-settings'
                        ? 'bg-gold-400/10 text-gold-400 border-b-2 lg:border-b-0 lg:border-l-4 border-gold-400'
                        : 'text-charcoal-300 hover:bg-charcoal-700 hover:text-ivory'
                    }`}
                  >
                    Brand Settings
                  </button>
                  <button
                    onClick={() => setActiveTab('password-reset')}
                    className={`flex-1 lg:w-full text-center lg:text-left px-4 py-3 rounded-md text-sm font-medium transition-all duration-300 ${
                      activeTab === 'password-reset'
                        ? 'bg-gold-400/10 text-gold-400 border-b-2 lg:border-b-0 lg:border-l-4 border-gold-400'
                        : 'text-charcoal-300 hover:bg-charcoal-700 hover:text-ivory'
                    }`}
                  >
                    Password Reset
                  </button>
                </nav>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-w-0">
              {activeTab === 'price-adjustment' && (
                <div>
                  <div className="mb-8 flex justify-between items-center">
                    <div>
                      <h1 className="text-3xl font-display font-bold text-ivory uppercase tracking-wider">Price Adjustments</h1>
                      <div className="w-16 h-0.5 bg-gradient-to-r from-gold-400 to-gold-600 my-3"></div>
                      <p className="mt-2 text-sm text-charcoal-300">
                        Manage your personal price adjustments. You can add multiple adjustments per category.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowModal(true)}
                      className="inline-flex items-center px-4 py-2 border border-gold-400 text-sm font-medium rounded-md shadow-sm text-gold-400 bg-transparent hover:bg-gold-400 hover:text-black-rich transition-all duration-300 hover:shadow-[0_4px_20px_-2px_rgba(212,175,55,0.25)]"
                    >
                      Add Adjustment
                    </button>
                  </div>

                  {error && (
                    <div className="mb-4 rounded-md bg-red-900/20 border border-red-500/50 p-4">
                      <div className="text-sm text-red-400">{error}</div>
                    </div>
                  )}

                  {success && (
                    <div className="mb-4 rounded-md bg-green-900/20 border border-green-500/50 p-4">
                      <div className="text-sm text-green-400">{success}</div>
                    </div>
                  )}

                  <div className="bg-charcoal-800 border border-charcoal-700 shadow-lg overflow-hidden sm:rounded-md">
                    <ul className="divide-y divide-charcoal-700">
                      {adjustments.length > 0 ? (
                        adjustments.map((adjustment) => (
                          <li key={adjustment.id}>
                            <div className="px-4 py-4 sm:px-6 flex items-center justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-ivory">
                                  {TABLES.find(t => t.value === adjustment.table_name)?.label || adjustment.table_name}
                                </p>
                                <p className="mt-1 text-sm text-charcoal-400">
                                  <span className="font-medium text-gold-400">
                                    {adjustment.exact_amount !== null && adjustment.exact_amount !== undefined
                                      ? `$${adjustment.exact_amount} (exact amount)`
                                      : `${adjustment.adjustment_percentage > 0 ? '+' : ''}${adjustment.adjustment_percentage}%`
                                    }
                                  </span>
                                  {(adjustment.min_price || adjustment.max_price) && (
                                    <span className="ml-2 text-xs text-charcoal-500">
                                      (Range: ${adjustment.min_price || '0'} - ${adjustment.max_price || 'unlimited'})
                                    </span>
                                  )}
                                  <span className="ml-2 text-xs text-charcoal-500">
                                    (Created: {new Date(adjustment.created_at).toLocaleDateString()})
                                  </span>
                                </p>
                              </div>
                              <button
                                onClick={() => handleRemoveAdjustment(adjustment.id)}
                                disabled={removingAdjustmentId === adjustment.id}
                                className="ml-4 text-red-400 hover:text-red-300 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center transition-colors"
                              >
                                {removingAdjustmentId === adjustment.id ? (
                                  <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-red-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Removing...
                                  </>
                                ) : (
                                  'Remove'
                                )}
                              </button>
                            </div>
                          </li>
                        ))
                      ) : (
                        <li>
                          <div className="px-4 py-8 text-center text-sm text-charcoal-400">
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
                    <h1 className="text-3xl font-display font-bold text-ivory uppercase tracking-wider">Password Reset</h1>
                    <div className="w-16 h-0.5 bg-gradient-to-r from-gold-400 to-gold-600 my-3"></div>
                    <p className="mt-2 text-sm text-charcoal-300">
                      Change your account password. Make sure to use a strong password.
                    </p>
                  </div>

                  <div className="bg-charcoal-800 border border-charcoal-700 shadow-lg rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                      <h2 className="text-lg font-medium text-ivory mb-4">Change Password</h2>
                      
                      {passwordError && (
                        <div className="mb-4 rounded-md bg-red-900/20 border border-red-500/50 p-4">
                          <div className="flex">
                            <div className="flex-shrink-0">
                              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-red-400">{passwordError}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {passwordSuccess && (
                        <div className="mb-4 rounded-md bg-green-900/20 border border-green-500/50 p-4">
                          <div className="flex">
                            <div className="flex-shrink-0">
                              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-green-400">
                                Password updated successfully!
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <form onSubmit={handlePasswordChange} className="space-y-6">
                        <div>
                          <label htmlFor="current-password" className="block text-sm font-medium text-charcoal-300">
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
                              className="bg-charcoal-900 border border-charcoal-600 text-ivory placeholder-charcoal-500 focus:ring-gold-400 focus:border-gold-400 block w-full sm:text-sm rounded-md px-3 py-2"
                              placeholder="Enter your current password"
                            />
                          </div>
                        </div>

                        <div>
                          <label htmlFor="new-password" className="block text-sm font-medium text-charcoal-300">
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
                              className="bg-charcoal-900 border border-charcoal-600 text-ivory placeholder-charcoal-500 focus:ring-gold-400 focus:border-gold-400 block w-full sm:text-sm rounded-md px-3 py-2"
                              placeholder="Enter your new password (min 6 characters)"
                            />
                          </div>
                          <p className="mt-2 text-sm text-charcoal-400">
                            Password must be at least 6 characters long
                          </p>
                        </div>

                        <div>
                          <label htmlFor="confirm-password" className="block text-sm font-medium text-charcoal-300">
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
                              className="bg-charcoal-900 border border-charcoal-600 text-ivory placeholder-charcoal-500 focus:ring-gold-400 focus:border-gold-400 block w-full sm:text-sm rounded-md px-3 py-2"
                              placeholder="Confirm your new password"
                            />
                          </div>
                        </div>

                        <div>
                          <button
                            type="submit"
                            disabled={passwordLoading}
                            className="inline-flex justify-center py-2 px-4 border border-gold-400 shadow-sm text-sm font-medium rounded-md text-gold-400 bg-transparent hover:bg-gold-400 hover:text-black-rich transition-all duration-300 hover:shadow-[0_4px_20px_-2px_rgba(212,175,55,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {passwordLoading ? 'Updating...' : 'Update Password'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'brand-settings' && (
                <div>
                  <div className="mb-8">
                    <h1 className="text-3xl font-display font-bold text-ivory uppercase tracking-wider">Brand Settings</h1>
                    <div className="w-16 h-0.5 bg-gradient-to-r from-gold-400 to-gold-600 my-3"></div>
                    <p className="mt-2 text-sm text-charcoal-300">
                      Customize your brand name and logo. These will be displayed in the header and throughout the application.
                    </p>
                  </div>

                  <div className="bg-charcoal-800 border border-charcoal-700 shadow-lg rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                      <h2 className="text-lg font-medium text-ivory mb-4">Brand Customization</h2>
                      
                      {brandError && (
                        <div className="mb-4 rounded-md bg-red-900/20 border border-red-500/50 p-4">
                          <div className="flex">
                            <div className="flex-shrink-0">
                              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-red-400">{brandError}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {brandSuccess && (
                        <div className="mb-4 rounded-md bg-green-900/20 border border-green-500/50 p-4">
                          <div className="flex">
                            <div className="flex-shrink-0">
                              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-medium text-green-400">
                                Brand settings saved successfully! Refreshing page...
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <form onSubmit={handleSaveBrandSettings} className="space-y-6">
                        <div>
                          <label htmlFor="brand-name" className="block text-sm font-medium text-charcoal-300">
                            Brand Name
                          </label>
                          <div className="mt-1">
                            <input
                              id="brand-name"
                              name="brand-name"
                              type="text"
                              value={brandName}
                              onChange={(e) => setBrandName(e.target.value)}
                              className="bg-charcoal-900 border border-charcoal-600 text-ivory placeholder-charcoal-500 focus:ring-gold-400 focus:border-gold-400 block w-full sm:text-sm rounded-md px-3 py-2"
                              placeholder="Enter your brand name"
                            />
                          </div>
                          <p className="mt-2 text-sm text-charcoal-400">
                            This will be displayed in the header instead of the default name.
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-charcoal-300">
                            Brand Logo
                          </label>
                          <div className="mt-2">
                            {/* Logo Preview */}
                            {brandLogoPreview && (
                              <div className="mb-4 relative inline-block">
                                <div className="w-24 h-24 rounded-lg border-2 border-charcoal-600 overflow-hidden bg-charcoal-900">
                                  <Image
                                    src={brandLogoPreview}
                                    alt="Brand logo preview"
                                    width={96}
                                    height={96}
                                    className="w-full h-full object-contain"
                                    onError={() => setBrandLogoPreview(null)}
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={handleRemoveBrandLogo}
                                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                                  title="Remove logo"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            )}
                            
                            {/* Upload Input */}
                            <div className="flex items-center gap-4">
                              <label className="cursor-pointer inline-flex items-center px-4 py-2 border border-charcoal-600 text-sm font-medium rounded-md shadow-sm text-charcoal-300 bg-transparent hover:bg-charcoal-700 hover:text-ivory transition-all duration-300">
                                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                {isUploadingLogo ? 'Uploading...' : 'Upload Logo'}
                                <input
                                  ref={logoFileInputRef}
                                  type="file"
                                  accept="image/*"
                                  onChange={handleBrandLogoUpload}
                                  disabled={isUploadingLogo}
                                  className="hidden"
                                />
                              </label>
                              {isUploadingLogo && (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gold-400"></div>
                              )}
                            </div>
                            
                            {logoUploadError && (
                              <p className="mt-2 text-sm text-red-400">{logoUploadError}</p>
                            )}
                            
                            <p className="mt-2 text-sm text-charcoal-400">
                              Supported formats: JPEG, PNG, WebP, GIF. Max file size: 5MB.
                            </p>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-charcoal-700">
                          <button
                            type="submit"
                            disabled={brandLoading}
                            className="inline-flex justify-center py-2 px-4 border border-gold-400 shadow-sm text-sm font-medium rounded-md text-gold-400 bg-transparent hover:bg-gold-400 hover:text-black-rich transition-all duration-300 hover:shadow-[0_4px_20px_-2px_rgba(212,175,55,0.25)] disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {brandLoading ? 'Saving...' : 'Save Brand Settings'}
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
                <div className="fixed inset-0 bg-black-pure bg-opacity-80 transition-opacity" onClick={() => setShowModal(false)}></div>
                <div className="inline-block align-bottom bg-charcoal-800 border border-charcoal-700 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                  <form onSubmit={handleApplyAdjustment}>
                    <div className="bg-charcoal-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                      <h3 className="text-lg leading-6 font-medium text-ivory mb-4">Add Price Adjustment</h3>
                      <div className="space-y-4">
                        <div>
                          <label htmlFor="table_name" className="block text-sm font-medium text-charcoal-300">
                            Category
                          </label>
                          <select
                            id="table_name"
                            required
                            className="mt-1 block w-full bg-charcoal-900 border border-charcoal-600 text-ivory rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-gold-400 focus:border-gold-400 sm:text-sm"
                            value={formData.table_name}
                            onChange={(e) => setFormData({ ...formData, table_name: e.target.value })}
                          >
                            {TABLES.map((table) => (
                              <option key={table.value} value={table.value}>{table.label}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-charcoal-300 mb-2">
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
                                className="mr-2 text-gold-400 focus:ring-gold-400"
                              />
                              <span className="text-sm text-charcoal-300">Percentage</span>
                            </label>
                            <label className="flex items-center">
                              <input
                                type="radio"
                                name="adjustmentType"
                                value="exact"
                                checked={adjustmentType === 'exact'}
                                onChange={(e) => setAdjustmentType(e.target.value as 'percentage' | 'exact')}
                                className="mr-2 text-gold-400 focus:ring-gold-400"
                              />
                              <span className="text-sm text-charcoal-300">Exact Amount ($)</span>
                            </label>
                          </div>
                        </div>
                        {adjustmentType === 'percentage' ? (
                          <div>
                            <label htmlFor="adjustment_percentage" className="block text-sm font-medium text-charcoal-300">
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
                                className="block w-full bg-charcoal-900 border border-charcoal-600 text-ivory rounded-md shadow-sm py-2 px-3 pr-8 focus:outline-none focus:ring-gold-400 focus:border-gold-400 sm:text-sm"
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
                                <span className="text-charcoal-400 sm:text-sm">%</span>
                              </div>
                            </div>
                            <p className="mt-2 text-sm text-charcoal-400">
                              Only positive percentages are allowed. 
                            </p>
                          </div>
                        ) : (
                          <div>
                            <label htmlFor="exact_amount" className="block text-sm font-medium text-charcoal-300">
                              Exact Amount ($)
                            </label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="text-charcoal-400 text-sm">$</span>
                              </div>
                              <input
                                type="number"
                                id="exact_amount"
                                required={adjustmentType === 'exact'}
                                step="0.01"
                                min="0"
                                className="block w-full pl-7 pr-3 bg-charcoal-900 border border-charcoal-600 text-ivory rounded-md shadow-sm py-2 text-sm focus:outline-none focus:ring-gold-400 focus:border-gold-400"
                                placeholder="e.g., 1000"
                                value={formData.exact_amount}
                                onChange={(e) => setFormData({ ...formData, exact_amount: e.target.value })}
                              />
                            </div>
                            <p className="mt-2 text-sm text-charcoal-400">
                              This will replace the price with the exact amount instead of applying a percentage
                            </p>
                          </div>
                        )}
                        <div>
                          <label className="block text-sm font-medium text-charcoal-300 mb-2">
                            Price Range (Optional)
                          </label>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label htmlFor="min_price" className="block text-xs text-charcoal-400 mb-1">
                                Min Price
                              </label>
                              <div className="relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <span className="text-charcoal-400 text-sm">$</span>
                                </div>
                                <input
                                  type="number"
                                  id="min_price"
                                  step="0.01"
                                  min="0"
                                  className="block w-full pl-7 pr-3 bg-charcoal-900 border border-charcoal-600 text-ivory rounded-md shadow-sm py-2 text-sm focus:outline-none focus:ring-gold-400 focus:border-gold-400"
                                  placeholder="0"
                                  value={formData.min_price}
                                  onChange={(e) => setFormData({ ...formData, min_price: e.target.value })}
                                />
                              </div>
                            </div>
                            <div>
                              <label htmlFor="max_price" className="block text-xs text-charcoal-400 mb-1">
                                Max Price
                              </label>
                              <div className="relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <span className="text-charcoal-400 text-sm">$</span>
                                </div>
                                <input
                                  type="number"
                                  id="max_price"
                                  step="0.01"
                                  min="0"
                                  className="block w-full pl-7 pr-3 bg-charcoal-900 border border-charcoal-600 text-ivory rounded-md shadow-sm py-2 text-sm focus:outline-none focus:ring-gold-400 focus:border-gold-400"
                                  placeholder="Unlimited"
                                  value={formData.max_price}
                                  onChange={(e) => setFormData({ ...formData, max_price: e.target.value })}
                                />
                              </div>
                            </div>
                          </div>
                          <p className="mt-2 text-xs text-charcoal-400">
                            Adjustment will only apply to prices within this range. Leave empty for no limit.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-charcoal-900 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-charcoal-700">
                      <button
                        type="submit"
                        disabled={processing}
                        className="w-full inline-flex justify-center rounded-md border border-gold-400 shadow-sm px-4 py-2 bg-gold-400 text-base font-medium text-black-rich hover:bg-gold-500 transition-all duration-300 hover:shadow-[0_4px_20px_-2px_rgba(212,175,55,0.25)] disabled:opacity-50 sm:ml-3 sm:w-auto sm:text-sm"
                      >
                        {processing ? 'Applying...' : 'Apply Adjustment'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowModal(false)}
                        disabled={processing}
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-charcoal-600 shadow-sm px-4 py-2 bg-transparent text-base font-medium text-charcoal-300 hover:bg-charcoal-700 hover:text-ivory transition-all duration-300 disabled:opacity-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
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

