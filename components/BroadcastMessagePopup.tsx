'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-client'

interface Message {
  recipientId: string
  messageId: string
  title: string
  message: string
  createdAt: string
  isClosed: boolean
}

export default function BroadcastMessagePopup() {
  const [messages, setMessages] = useState<Message[]>([])
  const [currentMessageIndex, setCurrentMessageIndex] = useState(0)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const supabase = createClient()

  const fetchMessages = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) {
        setIsInitialLoad(true)
      }
      
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      
      if (!token) {
        console.log('⚠️ No auth token, skipping message fetch')
        return
      }

      const response = await fetch('/api/broadcast-messages', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Failed to fetch messages:', response.status, errorData)
        // Don't throw on polling errors, just log them
        if (isInitial) {
          throw new Error(errorData.error || 'Failed to fetch messages')
        }
        return
      }

      const data = await response.json()
      console.log('📨 Received messages:', data)
      
      const unreadMessages = (data.messages || []).filter((msg: Message) => !msg.isClosed)
      
      if (unreadMessages.length > 0) {
        // Only update if we have messages and they're different from current ones
        setMessages(prev => {
          // If we already have messages displayed, only add new ones (by recipientId)
          if (prev.length > 0) {
            const existingIds = new Set(prev.map((m: Message) => m.recipientId))
            const newMessages = unreadMessages.filter((m: Message) => !existingIds.has(m.recipientId))
            // Only update if there are actually new messages
            if (newMessages.length > 0) {
              return [...prev, ...newMessages]
            }
            // Otherwise keep existing messages - don't replace them
            return prev
          }
          // First load - set all messages
          return unreadMessages
        })
        
        // Only set index to 0 on initial load
        if (isInitial) {
          setCurrentMessageIndex(0)
        }
      } else {
        // Only clear messages if this is initial load and there are no messages
        // Don't clear if user is viewing a message (prev.length > 0)
        if (isInitial) {
          setMessages(prev => {
            if (prev.length === 0) {
              return []
            }
            return prev // Keep existing messages even if API returns empty
          })
          setCurrentMessageIndex(-1)
        }
      }
    } catch (err) {
      console.error('Error fetching messages:', err)
    } finally {
      if (isInitial) {
        setIsInitialLoad(false)
      }
    }
  }, [supabase])

  const closeMessage = useCallback(async (recipientId: string) => {
    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token || ''
      
      if (!token) {
        console.error('No auth token for closing message')
        return
      }

      const response = await fetch('/api/broadcast-messages', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ recipientId })
      })

      if (!response.ok) {
        throw new Error('Failed to close message')
      }

      // Remove the closed message from the list
      setMessages(prev => prev.filter(msg => msg.recipientId !== recipientId))
      
      // If there are more messages, show the next one
      if (messages.length > 1) {
        setCurrentMessageIndex(0)
      } else {
        setCurrentMessageIndex(-1)
      }
    } catch (err) {
      console.error('Error closing message:', err)
    }
  }, [messages.length, supabase])

  // Poll for messages every 5 seconds
  useEffect(() => {
    // Fetch immediately on mount (initial load)
    fetchMessages(true)

    // Then poll every 5 seconds (non-initial, won't clear existing messages)
    const interval = setInterval(() => {
      fetchMessages(false)
    }, 5000)

    return () => clearInterval(interval)
  }, [fetchMessages])

  const currentMessage = messages[currentMessageIndex]

  // Only hide during initial load, not during polling
  if (!currentMessage || isInitialLoad) {
    return null
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none animate-fade-in">
      {/* Backdrop with blur */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm pointer-events-auto" onClick={() => closeMessage(currentMessage.recipientId)}></div>
      
      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full pointer-events-auto transform transition-all animate-scale-in border border-gray-100 overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 relative">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white leading-tight">
                  {currentMessage.title}
                </h3>
                <p className="text-xs text-red-100 mt-0.5">
                  New Message
                </p>
              </div>
            </div>
            <button
              onClick={() => closeMessage(currentMessage.recipientId)}
              className="flex-shrink-0 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all duration-200 flex items-center justify-center group"
              aria-label="Close message"
            >
              <svg className="h-5 w-5 text-white group-hover:rotate-90 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Message Content */}
        <div className="px-6 py-5 pb-6">
          <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed mb-4">
            {currentMessage.message}
          </div>
          
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{new Date(currentMessage.createdAt).toLocaleString()}</span>
            </div>
            
            {messages.length > 1 && (
              <div className="flex items-center space-x-3">
                <span className="text-xs text-gray-500 font-medium">
                  {currentMessageIndex + 1} / {messages.length}
                </span>
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => setCurrentMessageIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentMessageIndex === 0}
                    className="p-1.5 rounded-md text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:text-gray-300 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all"
                    aria-label="Previous message"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setCurrentMessageIndex(prev => Math.min(messages.length - 1, prev + 1))}
                    disabled={currentMessageIndex === messages.length - 1}
                    className="p-1.5 rounded-md text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:text-gray-300 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all"
                    aria-label="Next message"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}

