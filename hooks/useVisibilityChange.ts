'use client'

import { useEffect, useState } from 'react'
import { refreshSession } from '@/lib/session-refresh'

/**
 * Hook to detect when the browser tab becomes visible again
 * Returns true when tab is visible, false when hidden
 * Also provides a callback mechanism for when tab becomes visible
 * Automatically refreshes session when tab becomes visible
 */
export function useVisibilityChange() {
  const [isVisible, setIsVisible] = useState(true)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    const handleVisibilityChange = async () => {
      const visible = document.visibilityState === 'visible'
      setIsVisible(visible)
      
      // Trigger refresh when tab becomes visible
      if (visible) {
        console.log('👁️ [VisibilityHook] Tab became visible, refreshing session first...')
        
        // Refresh session BEFORE triggering component refresh
        // This ensures session is ready when components try to fetch
        try {
          const refreshed = await refreshSession()
          if (refreshed) {
            console.log('✅ [VisibilityHook] Session refreshed, now triggering component refresh')
          } else {
            console.warn('⚠️ [VisibilityHook] Session refresh failed, but continuing...')
          }
        } catch (error: any) {
          console.error('❌ [VisibilityHook] Error refreshing session:', error.message)
        }
        
        // Small delay to ensure session is fully ready
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Now trigger component refresh
        console.log('🔄 [VisibilityHook] Triggering component refresh')
        setRefreshTrigger(prev => prev + 1)
      }
    }

    // Also listen for focus events
    const handleFocus = async () => {
      if (document.visibilityState === 'visible') {
        console.log('👁️ [VisibilityHook] Window focused, refreshing session first...')
        
        try {
          const refreshed = await refreshSession()
          if (refreshed) {
            console.log('✅ [VisibilityHook] Session refreshed on focus, triggering component refresh')
          }
        } catch (error: any) {
          console.error('❌ [VisibilityHook] Error refreshing session on focus:', error.message)
        }
        
        // Small delay to ensure session is fully ready
        await new Promise(resolve => setTimeout(resolve, 100))
        
        setRefreshTrigger(prev => prev + 1)
      }
    }

    // Set initial state
    setIsVisible(document.visibilityState === 'visible')

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  return { isVisible, refreshTrigger }
}

