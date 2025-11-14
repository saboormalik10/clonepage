import { createClient } from './supabase-client'

/**
 * Refresh session with timeout - returns null on timeout instead of throwing
 * Uses shorter timeout for faster response
 */
async function refreshSessionWithTimeout(supabase: any, timeoutMs: number = 5000): Promise<any> {
  try {
    return await Promise.race([
      supabase.auth.refreshSession(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Session refresh timeout')), timeoutMs)
      )
    ]) as Promise<{ data: { session: any }, error: any }>
  } catch (timeoutError: any) {
    // On timeout, return error object instead of throwing
    console.warn('⚠️ [SessionRefresh] Session refresh timed out')
    return { data: { session: null }, error: { message: 'Session refresh timeout' } }
  }
}

/**
 * Refresh the Supabase session
 * This is useful when the tab becomes visible again after being inactive
 * Returns true if refreshed, false if failed, but doesn't throw on timeout
 */
export async function refreshSession(): Promise<boolean> {
  try {
    console.log('🔄 [SessionRefresh] Starting session refresh...')
    const supabase = createClient()
    const { data: { session }, error } = await refreshSessionWithTimeout(supabase, 5000)
    
    if (error) {
      // Don't treat timeout as complete failure - session might still be valid
      if (error.message?.includes('timeout')) {
        console.warn('⚠️ [SessionRefresh] Refresh timed out, but existing session may still be valid')
        // Check if we have a valid session anyway
        try {
          const { data: { session: existingSession } } = await supabase.auth.getSession()
          if (existingSession?.access_token) {
            console.log('✅ [SessionRefresh] Using existing valid session')
            return true
          }
        } catch (checkError) {
          // Ignore check errors
        }
      } else {
        console.warn('⚠️ [SessionRefresh] Failed to refresh session:', error.message)
      }
      return false
    }
    
    if (session?.access_token) {
      console.log('✅ [SessionRefresh] Session refreshed successfully')
      return true
    }
    
    console.warn('⚠️ [SessionRefresh] No session after refresh')
    return false
  } catch (error: any) {
    // This shouldn't happen now since refreshSessionWithTimeout doesn't throw
    console.error('❌ [SessionRefresh] Error refreshing session:', error.message)
    return false
  }
}

/**
 * Get session with timeout and localStorage fallback
 * Uses shorter timeout for faster response
 */
async function getSessionWithTimeout(supabase: any, timeoutMs: number = 3000): Promise<any> {
  try {
    return await Promise.race([
      supabase.auth.getSession(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Session retrieval timeout')), timeoutMs)
      )
    ]) as Promise<{ data: { session: any }, error: any }>
  } catch (timeoutError: any) {
    // Try localStorage fallback
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
            return {
              data: {
                session: {
                  access_token: parsed.access_token,
                  refresh_token: parsed.refresh_token,
                  expires_at: parsed.expires_at,
                  user: parsed.user
                }
              },
              error: null
            }
          }
        }
      }
    } catch (storageError) {
      // Ignore storage errors
    }
    throw timeoutError
  }
}

/**
 * Check if there's a valid session
 * Uses longer timeout and localStorage fallback
 */
export async function hasValidSession(): Promise<boolean> {
  try {
    const supabase = createClient()
    const { data: { session }, error } = await getSessionWithTimeout(supabase, 3000)
    
    if (error) {
      // Don't log timeout as error - it's expected when tab was inactive
      if (!error.message?.includes('timeout')) {
        console.warn('⚠️ [SessionRefresh] Error checking session:', error.message)
      }
      return false
    }
    
    return !!session?.access_token
  } catch (error: any) {
    // Timeout is expected when coming back from inactive tab
    if (!error.message?.includes('timeout')) {
      console.error('❌ [SessionRefresh] Error checking session:', error.message)
    }
    return false
  }
}

