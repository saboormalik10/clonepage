'use client'

import { useEffect, useState } from 'react'

/**
 * Hook to detect when the browser tab becomes visible again
 * Returns true when tab is visible, false when hidden
 * Also provides a callback mechanism for when tab becomes visible
 * Uses localStorage-first approach to avoid session timeout issues
 */
export function useVisibilityChange() {
  const [isVisible, setIsVisible] = useState(true)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    let debounceTimer: NodeJS.Timeout | null = null
    let lastTriggerTime = 0
    let wasHidden = false // Track if tab was actually hidden
    const DEBOUNCE_DELAY = 5000 // 5 seconds debounce - only refresh if tab was hidden for a while

    const triggerRefresh = () => {
      const now = Date.now()
      
      // Debounce: only trigger if enough time has passed since last trigger
      if (now - lastTriggerTime < DEBOUNCE_DELAY) {
        console.log('🔄 [VisibilityHook] Refresh debounced, too soon since last trigger')
        return
      }
      
      lastTriggerTime = now
      console.log('🔄 [VisibilityHook] Triggering component refresh')
      setRefreshTrigger(prev => prev + 1)
    }

    const handleVisibilityChange = async () => {
      const visible = document.visibilityState === 'visible'
      setIsVisible(visible)
      
      if (visible) {
        // Only trigger refresh if the tab was actually hidden before
        if (wasHidden) {
          console.log('👁️ [VisibilityHook] Tab became visible after being hidden')
          
          // Clear any existing debounce timer
          if (debounceTimer) {
            clearTimeout(debounceTimer)
          }
          
          // Debounce the refresh trigger
          debounceTimer = setTimeout(() => {
            triggerRefresh()
          }, 1000) // 1 second delay
          
          wasHidden = false
        } else {
          console.log('👁️ [VisibilityHook] Tab visible but was not hidden - no refresh needed')
        }
      } else {
        console.log('👁️ [VisibilityHook] Tab became hidden')
        wasHidden = true
        
        // Clear any pending refresh when tab becomes hidden
        if (debounceTimer) {
          clearTimeout(debounceTimer)
          debounceTimer = null
        }
      }
    }

    // Remove focus event listener - it's too aggressive and not needed
    // Only use visibility change which is more reliable

    // Set initial state
    setIsVisible(document.visibilityState === 'visible')

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      
      // Clear debounce timer on cleanup
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
    }
  }, [])

  return { isVisible, refreshTrigger }
}

