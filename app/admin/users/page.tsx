'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase-client'

interface User {
  id: string
  email: string
  full_name: string | null
  role: string
  brand_name: string | null
  brand_logo: string | null
  created_at: string
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [creatingUser, setCreatingUser] = useState(false)
  const [updatingUser, setUpdatingUser] = useState(false)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'user' as 'admin' | 'user',
    brand_name: '',
    brand_logo: '',
  })
  const [editFormData, setEditFormData] = useState({
    password: '',
    full_name: '',
    role: 'user' as 'admin' | 'user',
    brand_name: '',
    brand_logo: '',
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [brandLogoPreview, setBrandLogoPreview] = useState<string | null>(null)
  const [editBrandLogoPreview, setEditBrandLogoPreview] = useState<string | null>(null)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [isUploadingEditLogo, setIsUploadingEditLogo] = useState(false)
  const [logoUploadError, setLogoUploadError] = useState('')
  const [editLogoUploadError, setEditLogoUploadError] = useState('')
  const logoFileInputRef = useRef<HTMLInputElement>(null)
  const editLogoFileInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }

  const fetchUsers = async () => {
    try {
      const token = await getAuthToken()
      const response = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch users')
      }

      const data = await response.json()
      // Filter out admin users (double check in case API doesn't filter)
      const filteredUsers = (data.users || []).filter((user: User) => user.role !== 'admin')
      setUsers(filteredUsers)
    } catch (err: any) {
      console.error('Error fetching users:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setCreatingUser(true)

    try {
      const token = await getAuthToken()
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user')
      }

      setSuccess('User created successfully!')
      setFormData({ email: '', password: '', full_name: '', role: 'user', brand_name: '', brand_logo: '' })
      setBrandLogoPreview(null)
      setLogoUploadError('')
      if (logoFileInputRef.current) {
        logoFileInputRef.current.value = ''
      }
      setShowCreateModal(false)
      
      // Immediately refresh the list
      await fetchUsers()
    } catch (err: any) {
      setError(err.message || 'Failed to create user')
    } finally {
      setCreatingUser(false)
    }
  }

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
      
      // Get auth token
      const getAuthToken = () => {
        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
          let projectRef = 'default'
          try {
            const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)
            if (urlMatch && urlMatch[1]) {
              projectRef = urlMatch[1]
            } else {
              const parts = supabaseUrl.split('//')
              if (parts[1]) {
                projectRef = parts[1].split('.')[0]
              }
            }
          } catch (e) {}
          const storageKey = `sb-${projectRef}-auth-token`
          const stored = localStorage.getItem(storageKey)
          if (stored) {
            const parsed = JSON.parse(stored)
            if (parsed?.access_token && parsed?.expires_at) {
              const expiresAt = parsed.expires_at * 1000
              if (expiresAt > Date.now()) {
                return parsed.access_token
              }
            }
          }
        } catch (error) {}
        return ''
      }
      
      const token = getAuthToken()
      if (!token) {
        throw new Error('No authentication token found. Please log in again.')
      }
      
      // Upload file
      const uploadFormData = new FormData()
      uploadFormData.append('file', file)
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000)
      
      let response: Response
      try {
        response = await fetch('/api/admin/upload', {
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
        throw new Error(data.error || data.details?.message || 'Failed to upload image')
      }
      
      if (!data.logo) {
        throw new Error('Upload succeeded but no image reference returned')
      }
      
      // Extract public URL from upload response
      const logoObj = data.logo
      let publicUrl = ''
      
      if (logoObj.asset?._metadata?.isSupabaseUpload && logoObj.asset._metadata.storagePath) {
        // Supabase upload - get public URL
        const { data: { publicUrl: url } } = supabase.storage
          .from('publications')
          .getPublicUrl(logoObj.asset._metadata.storagePath)
        publicUrl = url
      } else if (logoObj.asset?._ref) {
        // Legacy Sanity format - use Sanity CDN
        const ref = logoObj.asset._ref.replace('image-', '')
        publicUrl = `https://cdn.sanity.io/images/8n90kyzz/production/${ref.replace(/-png$/, '.png').replace(/-jpg$/, '.jpg').replace(/-jpeg$/, '.jpeg').replace(/-webp$/, '.webp')}?w=80&h=80&fit=crop&auto=format&q=75`
      } else {
        throw new Error('Invalid upload response format')
      }
      
      // Store the public URL in form data
      setFormData(prev => ({ ...prev, brand_logo: publicUrl }))
      setBrandLogoPreview(publicUrl)
    } catch (err: any) {
      setLogoUploadError(err.message || 'Failed to upload image')
      setBrandLogoPreview(null)
      if (logoFileInputRef.current) {
        logoFileInputRef.current.value = ''
      }
    } finally {
      setIsUploadingLogo(false)
    }
  }, [supabase])

  const handleEditUser = (user: User) => {
    setEditingUser(user)
    setEditFormData({
      password: '',
      full_name: user.full_name || '',
      role: user.role as 'admin' | 'user',
      brand_name: user.brand_name || '',
      brand_logo: user.brand_logo || '',
    })
    setEditBrandLogoPreview(user.brand_logo || null)
    setEditLogoUploadError('')
    setShowEditModal(true)
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    setError('')
    setSuccess('')
    setUpdatingUser(true)

    try {
      const token = await getAuthToken()
      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: editingUser.id,
          password: editFormData.password || undefined, // Only send if provided
          full_name: editFormData.full_name,
          role: editFormData.role,
          brand_name: editFormData.brand_name,
          brand_logo: editFormData.brand_logo,
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update user')
      }

      setSuccess('User updated successfully!')
      setShowEditModal(false)
      setEditingUser(null)
      setEditFormData({ password: '', full_name: '', role: 'user', brand_name: '', brand_logo: '' })
      setEditBrandLogoPreview(null)
      if (editLogoFileInputRef.current) {
        editLogoFileInputRef.current.value = ''
      }
      
      // Refresh the list
      await fetchUsers()
    } catch (err: any) {
      setError(err.message || 'Failed to update user')
    } finally {
      setUpdatingUser(false)
    }
  }

  const handleEditBrandLogoUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setEditLogoUploadError('')
    setIsUploadingEditLogo(true)
    
    try {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
      if (!allowedTypes.includes(file.type)) {
        setEditLogoUploadError('Invalid file type. Only images are allowed.')
        setIsUploadingEditLogo(false)
        return
      }
      
      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024 // 5MB
      if (file.size > maxSize) {
        setEditLogoUploadError('File size exceeds 5MB limit')
        setIsUploadingEditLogo(false)
        return
      }
      
      // Show preview
      const reader = new FileReader()
      reader.onloadend = () => setEditBrandLogoPreview(reader.result as string)
      reader.readAsDataURL(file)
      
      // Get auth token
      const getAuthToken = () => {
        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
          let projectRef = 'default'
          try {
            const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)
            if (urlMatch && urlMatch[1]) {
              projectRef = urlMatch[1]
            } else {
              const parts = supabaseUrl.split('//')
              if (parts[1]) {
                projectRef = parts[1].split('.')[0]
              }
            }
          } catch (e) {}
          const storageKey = `sb-${projectRef}-auth-token`
          const stored = localStorage.getItem(storageKey)
          if (stored) {
            const parsed = JSON.parse(stored)
            if (parsed?.access_token && parsed?.expires_at) {
              const expiresAt = parsed.expires_at * 1000
              if (expiresAt > Date.now()) {
                return parsed.access_token
              }
            }
          }
        } catch (error) {}
        return ''
      }
      
      const token = getAuthToken()
      if (!token) {
        throw new Error('No authentication token found. Please log in again.')
      }
      
      // Upload file
      const uploadFormData = new FormData()
      uploadFormData.append('file', file)
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000)
      
      let response: Response
      try {
        response = await fetch('/api/admin/upload', {
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
        throw new Error(data.error || data.details?.message || 'Failed to upload image')
      }
      
      if (!data.logo) {
        throw new Error('Upload succeeded but no image reference returned')
      }
      
      // Extract public URL from upload response
      const logoObj = data.logo
      let publicUrl = ''
      
      if (logoObj.asset?._metadata?.isSupabaseUpload && logoObj.asset._metadata.storagePath) {
        // Supabase upload - get public URL
        const { data: { publicUrl: url } } = supabase.storage
          .from('publications')
          .getPublicUrl(logoObj.asset._metadata.storagePath)
        publicUrl = url
      } else if (logoObj.asset?._ref) {
        // Legacy Sanity format - use Sanity CDN
        const ref = logoObj.asset._ref.replace('image-', '')
        publicUrl = `https://cdn.sanity.io/images/8n90kyzz/production/${ref.replace(/-png$/, '.png').replace(/-jpg$/, '.jpg').replace(/-jpeg$/, '.jpeg').replace(/-webp$/, '.webp')}?w=80&h=80&fit=crop&auto=format&q=75`
      } else {
        throw new Error('Invalid upload response format')
      }
      
      // Store the public URL in form data
      setEditFormData(prev => ({ ...prev, brand_logo: publicUrl }))
      setEditBrandLogoPreview(publicUrl)
    } catch (err: any) {
      setEditLogoUploadError(err.message || 'Failed to upload image')
      setEditBrandLogoPreview(null)
      if (editLogoFileInputRef.current) {
        editLogoFileInputRef.current.value = ''
      }
    } finally {
      setIsUploadingEditLogo(false)
    }
  }, [supabase])

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return

    setError('')
    setSuccess('')
    setDeletingUserId(userId)
    
    // Optimistic update - remove from UI immediately
    const previousUsers = [...users]
    setUsers((prev: User[]) => prev.filter((user: User) => user.id !== userId))

    try {
      const token = await getAuthToken()
      const response = await fetch(`/api/admin/users?userId=${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (!response.ok) {
        // Revert optimistic update on error
        setUsers(previousUsers)
        throw new Error(data.error || 'Failed to delete user')
      }

      setSuccess('User deleted successfully!')
      // Refresh to ensure consistency
      await fetchUsers()
    } catch (err: any) {
      setError(err.message || 'Failed to delete user')
    } finally {
      setDeletingUserId(null)
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
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <p className="mt-2 text-sm text-gray-600">
            Create and manage users
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Create User
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
          {users.map((user) => (
            <li key={user.id}>
              <div className="px-4 py-4 sm:px-6 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {user.brand_logo && (
                    <div className="flex-shrink-0">
                      <img
                        src={user.brand_logo}
                        alt={user.brand_name || 'Brand logo'}
                        className="h-12 w-12 object-contain border border-gray-200 rounded"
                        onError={(e) => {
                          // Hide image if it fails to load
                          const target = e.target as HTMLImageElement
                          target.style.display = 'none'
                        }}
                      />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-indigo-600 truncate">
                      {user.email}
                    </p>
                    <p className="mt-2 flex items-center text-sm text-gray-500">
                      {user.full_name || 'No name'}
                      {user.role !== 'admin' && (
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {user.role}
                        </span>
                      )}
                    </p>
                    {user.brand_name && (
                      <p className="mt-1 text-xs text-gray-400">
                        Brand: {user.brand_name}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => handleEditUser(user)}
                    className="text-indigo-600 hover:text-indigo-900 text-sm font-medium inline-flex items-center"
                  >
                    <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteUser(user.id)}
                    disabled={deletingUserId === user.id}
                    className="text-red-600 hover:text-red-900 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center"
                  >
                    {deletingUserId === user.id ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-red-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Deleting...
                      </>
                    ) : (
                      'Delete'
                    )}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {showCreateModal && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowCreateModal(false)}></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleCreateUser}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Create New User</h3>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                        Email
                      </label>
                      <input
                        type="email"
                        id="email"
                        required
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                    <div>
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                        Password
                      </label>
                      <input
                        type="password"
                        id="password"
                        required
                        minLength={6}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      />
                    </div>
                    <div>
                      <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
                        Full Name (optional)
                      </label>
                      <input
                        type="text"
                        id="full_name"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        value={formData.full_name}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label htmlFor="role" className="block text-sm font-medium text-gray-700">
                        Role
                      </label>
                      <select
                        id="role"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value as 'admin' | 'user' })}
                      >
                        <option value="user">User</option>
                        {/* <option value="admin">Admin</option> */}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="brand_name" className="block text-sm font-medium text-gray-700">
                        Brand Name
                      </label>
                      <input
                        type="text"
                        id="brand_name"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="e.g., Hotshot Social"
                        value={formData.brand_name}
                        onChange={(e) => setFormData({ ...formData, brand_name: e.target.value })}
                      />
                      <p className="mt-1 text-xs text-gray-500">This will replace &quot;Hotshot Social&quot; in the app</p>
                    </div>
                    <div>
                      <label htmlFor="brand_logo" className="block text-sm font-medium text-gray-700">
                        Brand Logo
                      </label>
                      <input
                        type="file"
                        id="brand_logo"
                        ref={logoFileInputRef}
                        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                        className="mt-1 block w-full text-sm text-gray-500
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-md file:border-0
                          file:text-sm file:font-semibold
                          file:bg-indigo-50 file:text-indigo-700
                          hover:file:bg-indigo-100
                          file:cursor-pointer
                          focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        onChange={handleBrandLogoUpload}
                        disabled={isUploadingLogo}
                      />
                      {isUploadingLogo && (
                        <p className="mt-1 text-xs text-indigo-600">Uploading...</p>
                      )}
                      {logoUploadError && (
                        <p className="mt-1 text-xs text-red-600">{logoUploadError}</p>
                      )}
                      {brandLogoPreview && (
                        <div className="mt-2">
                          <img
                            src={brandLogoPreview}
                            alt="Brand logo preview"
                            className="h-16 w-16 object-contain border border-gray-300 rounded"
                          />
                        </div>
                      )}
                      <p className="mt-1 text-xs text-gray-500">Upload a logo image (max 5MB). Supported formats: JPEG, PNG, WebP, GIF</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={creatingUser}
                    className="w-full inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    {creatingUser ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Creating...
                      </>
                    ) : (
                      'Create'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    disabled={creatingUser}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showEditModal && editingUser && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowEditModal(false)}></div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleUpdateUser}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Edit User</h3>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="edit_email" className="block text-sm font-medium text-gray-700">
                        Email
                      </label>
                      <input
                        type="email"
                        id="edit_email"
                        readOnly
                        disabled
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-100 text-gray-500 cursor-not-allowed sm:text-sm"
                        value={editingUser.email}
                      />
                      <p className="mt-1 text-xs text-gray-500">Email cannot be changed</p>
                    </div>
                    <div>
                      <label htmlFor="edit_password" className="block text-sm font-medium text-gray-700">
                        Password (leave blank to keep current)
                      </label>
                      <input
                        type="password"
                        id="edit_password"
                        minLength={6}
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        value={editFormData.password}
                        onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                        placeholder="Enter new password"
                      />
                      <p className="mt-1 text-xs text-gray-500">Only fill this if you want to change the password</p>
                    </div>
                    <div>
                      <label htmlFor="edit_full_name" className="block text-sm font-medium text-gray-700">
                        Full Name (optional)
                      </label>
                      <input
                        type="text"
                        id="edit_full_name"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        value={editFormData.full_name}
                        onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label htmlFor="edit_role" className="block text-sm font-medium text-gray-700">
                        Role
                      </label>
                      <select
                        id="edit_role"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        value={editFormData.role}
                        onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value as 'admin' | 'user' })}
                      >
                        <option value="user">User</option>
                        {/* <option value="admin">Admin</option> */}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="edit_brand_name" className="block text-sm font-medium text-gray-700">
                        Brand Name
                      </label>
                      <input
                        type="text"
                        id="edit_brand_name"
                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="e.g., Hotshot Social"
                        value={editFormData.brand_name}
                        onChange={(e) => setEditFormData({ ...editFormData, brand_name: e.target.value })}
                      />
                      <p className="mt-1 text-xs text-gray-500">This will replace &quot;Hotshot Social&quot; in the app</p>
                    </div>
                    <div>
                      <label htmlFor="edit_brand_logo" className="block text-sm font-medium text-gray-700">
                        Brand Logo
                      </label>
                      <input
                        type="file"
                        id="edit_brand_logo"
                        ref={editLogoFileInputRef}
                        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                        className="mt-1 block w-full text-sm text-gray-500
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-md file:border-0
                          file:text-sm file:font-semibold
                          file:bg-indigo-50 file:text-indigo-700
                          hover:file:bg-indigo-100
                          file:cursor-pointer
                          focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        onChange={handleEditBrandLogoUpload}
                        disabled={isUploadingEditLogo}
                      />
                      {isUploadingEditLogo && (
                        <p className="mt-1 text-xs text-indigo-600">Uploading...</p>
                      )}
                      {editLogoUploadError && (
                        <p className="mt-1 text-xs text-red-600">{editLogoUploadError}</p>
                      )}
                      {editBrandLogoPreview && (
                        <div className="mt-2">
                          <img
                            src={editBrandLogoPreview}
                            alt="Brand logo preview"
                            className="h-16 w-16 object-contain border border-gray-300 rounded"
                          />
                        </div>
                      )}
                      <p className="mt-1 text-xs text-gray-500">Upload a logo image (max 5MB). Supported formats: JPEG, PNG, WebP, GIF</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={updatingUser}
                    className="w-full inline-flex justify-center items-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    {updatingUser ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Updating...
                      </>
                    ) : (
                      'Update'
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditModal(false)
                      setEditingUser(null)
                      setEditFormData({ password: '', full_name: '', role: 'user', brand_name: '', brand_logo: '' })
                      setEditBrandLogoPreview(null)
                      if (editLogoFileInputRef.current) {
                        editLogoFileInputRef.current.value = ''
                      }
                    }}
                    disabled={updatingUser}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
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

