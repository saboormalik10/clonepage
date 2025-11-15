'use client'

import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase-client'

interface AdminContextType {
  isAdmin: boolean
  refreshAdminStatus: () => void
}

const AdminContext = createContext<AdminContextType>({
  isAdmin: false,
  refreshAdminStatus: () => {},
})

export function useAdmin() {
  return useContext(AdminContext)
}

// Get user ID from localStorage to avoid session timeout
function getUserIdFromStorage(): string | null {
  try {
    // Get Supabase project ref from URL
    // @ts-ignore - process.env is available in Next.js client components
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
    } catch (e) {
      // Use default if extraction fails
    }
    
    const storageKey = `sb-${projectRef}-auth-token`
    const stored = localStorage.getItem(storageKey)
    
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed?.user?.id && parsed?.expires_at) {
        const expiresAt = parsed.expires_at * 1000
        const now = Date.now()
        if (expiresAt > now) {
          return parsed.user.id
        }
      }
    }
  } catch (error) {
    console.error('Error getting user ID from localStorage:', error)
  }
  return null
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  const checkAdmin = useCallback(async () => {
    try {
      // Use localStorage only (instant, no timeout)
      const userId = getUserIdFromStorage()
      
      if (userId) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', userId)
          .single()
        
        setIsAdmin(profile?.role === 'admin')
      } else {
        setIsAdmin(false)
      }
    } catch (error) {
      console.error('Error checking admin status:', error)
      setIsAdmin(false)
    }
  }, [supabase])

  const refreshAdminStatus = useCallback(() => {
    checkAdmin()
  }, [checkAdmin])

  useEffect(() => {
    // Initial check
    checkAdmin()

    // Re-check admin status when tab becomes visible (for browser tab switching)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Small delay to ensure localStorage is updated
        setTimeout(() => {
          checkAdmin()
        }, 100)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Listen for localStorage changes (cross-tab storage events)
    const handleStorageChange = (e: StorageEvent) => {
      // Check if the auth token storage key changed
      try {
        // @ts-ignore - process.env is available in Next.js client components
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
        } catch (e) {
          // Use default if extraction fails
        }
        
        const storageKey = `sb-${projectRef}-auth-token`
        if (e.key === storageKey || e.key === null) {
          // Auth token changed, re-check admin status
          setTimeout(() => {
            checkAdmin()
          }, 100)
        }
      } catch (error) {
        // Ignore errors
      }
    }

    window.addEventListener('storage', handleStorageChange)

    // Periodic check when component is visible (every 1 second)
    // This ensures admin status updates even if events don't fire
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        checkAdmin()
      }
    }, 1000)

    // Listen for auth changes - use localStorage only
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async () => {
      // Use localStorage only
      const userId = getUserIdFromStorage()
      
      if (userId) {
        try {
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('role')
            .eq('id', userId)
            .single()
          
          setIsAdmin(profile?.role === 'admin')
        } catch (error) {
          console.error('Error checking admin status on auth change:', error)
          setIsAdmin(false)
        }
      } else {
        setIsAdmin(false)
      }
    })

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(intervalId)
    }
  }, [supabase, checkAdmin])

  return (
    <AdminContext.Provider value={{ isAdmin, refreshAdminStatus }}>
      {children}
    </AdminContext.Provider>
  )
}

