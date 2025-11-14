'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase-client'
import BroadcastMessageForm from '@/components/BroadcastMessageForm'

interface User {
  id: string
  email: string
  full_name?: string
  role: string
}

interface BroadcastMessage {
  id: string
  title: string
  message: string
  created_by: string
  send_to_all: boolean
  created_at: string
}

export default function BroadcastMessagesPage() {
  const [users, setUsers] = useState<User[]>([])
  const [messages, setMessages] = useState<BroadcastMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const supabase = createClient()

  useEffect(() => {
    fetchUsers()
    fetchMessages()
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
        throw new Error('Failed to fetch users')
      }

      const data = await response.json()
      // Filter out admin users
      const filteredUsers = (data.users || []).filter((user: User) => user.role !== 'admin')
      setUsers(filteredUsers)
    } catch (err: any) {
      console.error('Error fetching users:', err)
    }
  }

  const fetchMessages = async () => {
    try {
      const token = await getAuthToken()
      const response = await fetch('/api/admin/broadcast-messages', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch messages')
      }

      const data = await response.json()
      setMessages(data.messages || [])
    } catch (err: any) {
      console.error('Error fetching messages:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleMessageSent = () => {
    setShowForm(false)
    setSuccess('Message sent successfully!')
    fetchMessages()
    setTimeout(() => setSuccess(''), 3000)
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
          <h1 className="text-3xl font-bold text-gray-900">Broadcast Messages</h1>
          <p className="mt-2 text-sm text-gray-600">
            Send messages to all users or specific users
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Message
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

      {showForm && (
        <BroadcastMessageForm
          users={users}
          onClose={() => setShowForm(false)}
          onSuccess={handleMessageSent}
          onError={(err) => setError(err)}
        />
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {messages.length === 0 ? (
            <li className="px-4 py-8 text-center text-gray-500">
              No messages yet. Create your first broadcast message!
            </li>
          ) : (
            messages.map((message) => (
              <li key={message.id}>
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h3 className="text-lg font-medium text-gray-900">{message.title}</h3>
                        {message.send_to_all && (
                          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                            All Users
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-gray-600 line-clamp-2">{message.message}</p>
                      <p className="mt-2 text-xs text-gray-500">
                        Sent on {new Date(message.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}

