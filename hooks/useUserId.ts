'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase-client'

// Get user ID from localStorage to avoid session timeout issues
function getUserIdFromStorage(): string | null {
  if (typeof window === 'undefined') return null
  
  try {
    // Try to find the Supabase auth token in localStorage
    // The key format is: sb-{projectRef}-auth-token
    const keys = Object.keys(localStorage)
    const authKey = keys.find(key => key.startsWith('sb-') && key.endsWith('-auth-token'))
    
    if (authKey) {
      const stored = localStorage.getItem(authKey)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed?.user?.id && parsed?.expires_at) {
          const expiresAt = parsed.expires_at * 1000
          const now = Date.now()
          if (expiresAt > now) {
            console.log('✅ [useUserId] Got user ID from localStorage:', parsed.user.id)
            return parsed.user.id
          } else {
            console.log('⚠️ [useUserId] Session expired in localStorage')
          }
        }
      }
    } else {
      console.log('⚠️ [useUserId] No Supabase auth token found in localStorage')
    }
  } catch (error) {
    console.error('❌ [useUserId] Error getting user ID from localStorage:', error)
  }
  return null
}

export function useUserId() {
  const [userId, setUserId] = useState<string | null>(() => getUserIdFromStorage())
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    // First try localStorage (instant)
    const storedUserId = getUserIdFromStorage()
    if (storedUserId) {
      setUserId(storedUserId)
    }

    // Then try Supabase session
    const getUserId = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.id) {
          console.log('✅ [useUserId] Got user ID from Supabase session:', session.user.id)
          setUserId(session.user.id)
        } else if (!storedUserId) {
          console.log('⚠️ [useUserId] No session found in Supabase or localStorage')
          setUserId(null)
        }
      } catch (error) {
        console.error('❌ [useUserId] Error getting session:', error)
        // Fall back to localStorage value
        if (!storedUserId) {
          setUserId(null)
        }
      }
    }

    getUserId()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('🔄 [useUserId] Auth state changed:', _event, session?.user?.id)
      setUserId(session?.user?.id || getUserIdFromStorage() || null)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  return userId
}


