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
            return parsed.user.id
          }
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
    const backupKey = `admin-backup-${userId}`
    
    // Try primary cache first
    let cached = localStorage.getItem(cacheKey)
    let source = 'primary'
    
    // If primary cache fails, try backup
    if (!cached) {
      cached = localStorage.getItem(backupKey)
      source = 'backup'
    }
    
    if (cached) {
      const parsed = JSON.parse(cached)
      if (parsed?.isAdmin !== undefined && parsed?.timestamp) {
        const age = Date.now() - parsed.timestamp
        // Cache is valid for 30 minutes (increased from 5 minutes)
        if (age < 30 * 60 * 1000) {
          console.log(`✅ [AdminContext] Retrieved admin status from ${source} cache:`, parsed.isAdmin)
          return parsed.isAdmin
        } else {
          console.log(`⚠️ [AdminContext] ${source} cache expired (${Math.round(age/60000)} minutes old)`)
        }
      }
    }
  } catch (error) {
    console.error('❌ [AdminContext] Error reading cached admin status:', error)
  }
  return null
}

function setCachedAdminStatus(userId: string, isAdmin: boolean): void {
  try {
    const cacheKey = `admin-status-${userId}`
    const backupKey = `admin-backup-${userId}` // Backup key for extra safety
    const cacheData = {
      isAdmin,
      timestamp: Date.now(),
      version: 1 // Add version for future compatibility
    }
    localStorage.setItem(cacheKey, JSON.stringify(cacheData))
    localStorage.setItem(backupKey, JSON.stringify(cacheData)) // Store backup
    console.log('✅ [AdminContext] Cached admin status:', isAdmin, 'for user:', userId)
  } catch (error) {
    console.error('❌ [AdminContext] Error caching admin status:', error)
  }
}

function clearCachedAdminStatus(userId: string): void {
  try {
    const cacheKey = `admin-status-${userId}`
    const backupKey = `admin-backup-${userId}`
    localStorage.removeItem(cacheKey)
    localStorage.removeItem(backupKey)
    console.log('🗑️ [AdminContext] Cleared cached admin status for user:', userId)
  } catch (error) {
    console.error('❌ [AdminContext] Error clearing cached admin status:', error)
  }
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(() => {
    // Initialize with cached value if available
    if (typeof window !== 'undefined') {
      const userId = getUserIdFromStorage()
      if (userId) {
        const cached = getCachedAdminStatus(userId)
        if (cached !== null) {
          console.log('🚀 [AdminContext] Initial admin status from cache:', cached)
          return cached
        }
      }
    }
    return false
  })
  const supabase = useMemo(() => createClient(), [])
  
  // Add debounce to prevent excessive checking
  const lastCheckTime = useMemo(() => ({ current: 0 }), [])

  const checkAdmin = useCallback(async () => {
    try {
      // Debounce: Don't check too frequently (max once per 5 seconds)
      const now = Date.now()
      if (now - lastCheckTime.current < 5000) {
        console.log('⏱️ [AdminContext] Skipping check - too recent (debounced)')
        return
      }
      lastCheckTime.current = now
      
      // Use localStorage only (instant, no timeout)
      const userId = getUserIdFromStorage()
      
      if (userId) {
        // Check cached admin status, but be more selective about when to use it
        const cachedStatus = getCachedAdminStatus(userId)
        if (cachedStatus !== null) {
          console.log('✅ [AdminContext] Found cached admin status:', cachedStatus)
          // Only use cached status if it's true (admin) - always verify false status
          if (cachedStatus === true) {
            console.log('✅ [AdminContext] Using cached ADMIN status (verified)')
            setIsAdmin(cachedStatus)
            return cachedStatus
          } else {
            console.log('⚠️ [AdminContext] Cached status is false - verifying with database')
            // Don't return early for false status - always verify with database
          }
        }

        // Also get the full session from localStorage to set in Supabase client
        try {
          // Find the Supabase auth token dynamically
          const keys = Object.keys(localStorage)
          const authKey = keys.find(key => key.startsWith('sb-') && key.endsWith('-auth-token'))
          
          if (authKey) {
            const stored = localStorage.getItem(authKey)
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
          // Database query failed - be more resilient with fallbacks
          const fallbackStatus = getCachedAdminStatus(userId)
          if (fallbackStatus !== null) {
            console.warn('⚠️ [AdminContext] Database query failed, using cached status:', fallbackStatus)
            setIsAdmin(fallbackStatus)
          } else {
            // Check if we were previously admin - don't lose admin status easily
            const currentStatus = isAdmin
            if (currentStatus) {
              console.warn('⚠️ [AdminContext] Database query failed, keeping current admin status')
              // Re-cache the current status to prevent losing it
              setCachedAdminStatus(userId, true)
            } else {
              console.error('❌ [AdminContext] Database query failed and no cache available:', dbError.message)
              setIsAdmin(false)
            }
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
    // Force a fresh check by clearing cache first
    const userId = getUserIdFromStorage()
    if (userId) {
      clearCachedAdminStatus(userId)
    }
    // Reset debounce timer to allow immediate check
    lastCheckTime.current = 0
    checkAdmin()
  }, [checkAdmin, lastCheckTime])

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
      // Check if any Supabase auth token changed
      if (e.key && e.key.startsWith('sb-') && e.key.endsWith('-auth-token')) {
        // Auth token changed, re-check admin status
        setTimeout(() => {
          checkAdmin()
        }, 100)
      } else if (e.key === null) {
        // Storage was cleared, re-check
        setTimeout(() => {
          checkAdmin()
        }, 100)
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

