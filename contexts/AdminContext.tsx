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

// Cache admin status in localStorage to avoid losing it on query failures
function getCachedAdminStatus(userId: string): boolean | null {
  try {
    const cacheKey = `admin-status-${userId}`
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      const parsed = JSON.parse(cached)
      if (parsed?.isAdmin !== undefined && parsed?.timestamp) {
        const age = Date.now() - parsed.timestamp
        // Cache is valid for 5 minutes
        if (age < 5 * 60 * 1000) {
          return parsed.isAdmin
        }
      }
    }
  } catch (error) {
    // Ignore cache errors
  }
  return null
}

function setCachedAdminStatus(userId: string, isAdmin: boolean): void {
  try {
    const cacheKey = `admin-status-${userId}`
    const cacheData = {
      isAdmin,
      timestamp: Date.now()
    }
    localStorage.setItem(cacheKey, JSON.stringify(cacheData))
  } catch (error) {
    // Ignore cache errors
  }
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  const checkAdmin = useCallback(async () => {
    try {
      // Use localStorage only (instant, no timeout)
      const userId = getUserIdFromStorage()
      
      if (userId) {
        // Check cached admin status first
        const cachedStatus = getCachedAdminStatus(userId)
        if (cachedStatus !== null) {
          console.log('✅ [AdminContext] Using cached admin status:', cachedStatus)
          setIsAdmin(cachedStatus)
          return
        }

        // Also get the full session from localStorage to set in Supabase client
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
          
          const stored = localStorage.getItem(storageKey)
          if (stored) {
            const parsed = JSON.parse(stored)
            if (parsed?.access_token && parsed?.expires_at) {
              const expiresAt = parsed.expires_at * 1000
              if (expiresAt > Date.now()) {
                // Set session in Supabase client for database queries
                try {
                  await Promise.race([
                    supabase.auth.setSession({
                      access_token: parsed.access_token,
                      refresh_token: parsed.refresh_token
                    }),
                    new Promise((_, reject) => 
                      setTimeout(() => reject(new Error('setSession timeout')), 1000)
                    )
                  ])
                } catch (setSessionError) {
                  // Continue even if setSession fails
                }
              }
            }
          }
        } catch (storageError) {
          // Ignore storage errors
        }

        // Query database with timeout protection
        try {
          const result = await Promise.race([
            supabase
              .from('user_profiles')
              .select('role')
              .eq('id', userId)
              .single(),
            new Promise<{ error: Error }>((_, reject) => 
              setTimeout(() => reject(new Error('Database query timeout')), 5000)
            )
          ]) as { data: { role: string } | null; error: any } | { error: Error }
          
          const { data: profile } = 'data' in result ? result : { data: null }
          
          const adminStatus = profile?.role === 'admin'
          setIsAdmin(adminStatus)
          
          // Cache the result for future use
          setCachedAdminStatus(userId, adminStatus)
          console.log('✅ [AdminContext] Admin status updated from database:', adminStatus)
          
        } catch (dbError: any) {
          // Database query failed - check if we have a previous cached status
          const fallbackStatus = getCachedAdminStatus(userId)
          if (fallbackStatus !== null) {
            console.warn('⚠️ [AdminContext] Database query failed, using cached status:', fallbackStatus)
            setIsAdmin(fallbackStatus)
          } else {
            console.error('❌ [AdminContext] Database query failed and no cache available:', dbError.message)
            setIsAdmin(false)
          }
        }
      } else {
        setIsAdmin(false)
      }
    } catch (error) {
      console.error('Error checking admin status:', error)
      // Don't immediately set to false - check if we have valid session and cached status
      const userId = getUserIdFromStorage()
      if (userId) {
        const cachedStatus = getCachedAdminStatus(userId)
        if (cachedStatus !== null) {
          console.warn('⚠️ [AdminContext] Error occurred but using cached admin status:', cachedStatus)
          setIsAdmin(cachedStatus)
          return
        }
      }
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

    // Periodic check when component is visible (every 30 seconds)
    // This ensures admin status updates even if events don't fire, but less frequently
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        checkAdmin()
      }
    }, 30000) // 30 seconds instead of 1 second

    // Listen for auth changes - use localStorage only
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async () => {
      // Re-check admin status when auth changes
      checkAdmin()
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

