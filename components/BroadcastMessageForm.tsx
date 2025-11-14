'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase-client'

interface User {
  id: string
  email: string
  full_name?: string
}

interface BroadcastMessageFormProps {
  users: User[]
  onClose: () => void
  onSuccess: () => void
  onError: (error: string) => void
}

export default function BroadcastMessageForm({
  users,
  onClose,
  onSuccess,
  onError
}: BroadcastMessageFormProps) {
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    sendToAll: false,
    selectedUserIds: [] as string[]
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [userSearchTerm, setUserSearchTerm] = useState('')
  const supabase = createClient()

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title.trim()) {
      onError('Title is required')
      return
    }

    if (!formData.message.trim()) {
      onError('Message is required')
      return
    }

    if (!formData.sendToAll && formData.selectedUserIds.length === 0) {
      onError('Please select at least one user or choose to send to all users')
      return
    }

    setIsSubmitting(true)

    try {
      const token = await getAuthToken()
      const response = await fetch('/api/admin/broadcast-messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: formData.title.trim(),
          message: formData.message.trim(),
          sendToAll: formData.sendToAll,
          userIds: formData.sendToAll ? [] : formData.selectedUserIds
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send message')
      }

      onSuccess()
    } catch (err: any) {
      console.error('Error sending message:', err)
      onError(err.message || 'Failed to send message')
    } finally {
      setIsSubmitting(false)
    }
  }, [formData, supabase, onSuccess, onError])

  const toggleUser = (userId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedUserIds: prev.selectedUserIds.includes(userId)
        ? prev.selectedUserIds.filter(id => id !== userId)
        : [...prev.selectedUserIds, userId]
    }))
  }

  return (
    <div className="fixed z-[9999] inset-0 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity z-[9998]" onClick={onClose}></div>
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full z-[9999] relative">
          <form onSubmit={handleSubmit}>
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Send Broadcast Message</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                  <input
                    type="text"
                    required
                    className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter message title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Message *</label>
                  <textarea
                    required
                    rows={6}
                    className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    value={formData.message}
                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                    placeholder="Enter your message"
                  />
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      checked={formData.sendToAll}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, sendToAll: e.target.checked, selectedUserIds: [] }))
                        setUserSearchTerm('') // Clear search when switching to "send to all"
                      }}
                    />
                    <span className="ml-2 text-sm text-gray-700">Send to all users</span>
                  </label>
                </div>

                {!formData.sendToAll && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Users</label>
                    
                    {/* Search Input */}
                    <div className="mb-2">
                      <input
                        type="text"
                        placeholder="Search users by name or email..."
                        className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        value={userSearchTerm}
                        onChange={(e) => setUserSearchTerm(e.target.value)}
                      />
                    </div>
                    
                    <div className="border border-gray-300 rounded-md max-h-60 overflow-y-auto">
                      {users.length === 0 ? (
                        <div className="px-4 py-8 text-center text-gray-500 text-sm">No users available</div>
                      ) : (() => {
                        // Filter users based on search term
                        const filteredUsers = users.filter(user => {
                          const searchLower = userSearchTerm.toLowerCase()
                          const nameMatch = user.full_name?.toLowerCase().includes(searchLower) || false
                          const emailMatch = user.email.toLowerCase().includes(searchLower)
                          return nameMatch || emailMatch
                        })
                        
                        if (filteredUsers.length === 0) {
                          return (
                            <div className="px-4 py-8 text-center text-gray-500 text-sm">
                              No users found matching &quot;{userSearchTerm}&quot;
                            </div>
                          )
                        }
                        
                        return (
                          <ul className="divide-y divide-gray-200">
                            {filteredUsers.map((user) => (
                              <li key={user.id} className="px-4 py-2 hover:bg-gray-50">
                                <label className="flex items-center cursor-pointer">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                    checked={formData.selectedUserIds.includes(user.id)}
                                    onChange={() => toggleUser(user.id)}
                                  />
                                  <span className="ml-3 text-sm text-gray-700">
                                    {user.full_name || user.email}
                                    {user.full_name && <span className="text-gray-500 ml-1">({user.email})</span>}
                                  </span>
                                </label>
                              </li>
                            ))}
                          </ul>
                        )
                      })()}
                    </div>
                    {formData.selectedUserIds.length > 0 && (
                      <p className="mt-2 text-sm text-gray-500">
                        {formData.selectedUserIds.length} user(s) selected
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Sending...' : 'Send Message'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

