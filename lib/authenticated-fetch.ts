import { createClient } from './supabase-client'

// In-memory session cache for instant access
let cachedSession: any = null
let cacheTimestamp = 0
const CACHE_DURATION = 30 * 1000 // Cache for 30 seconds

/**
 * Get Supabase project ref from URL
 */
function getProjectRef(): string {
  // Next.js makes NEXT_PUBLIC_* env vars available on client
  // @ts-ignore - process.env is available in Next.js client components
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  try {
    const urlMatch = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)
    if (urlMatch && urlMatch[1]) {
      return urlMatch[1]
    }
    const parts = supabaseUrl.split('//')
    if (parts[1]) {
      return parts[1].split('.')[0]
    }
  } catch (e) {
    // Ignore
  }
  return 'default'
}

/**
 * Get session from localStorage instantly (synchronous)
 */
function getSessionFromStorage(): any {
  try {
    const projectRef = getProjectRef()
    const storageKey = `sb-${projectRef}-auth-token`
    const stored = localStorage.getItem(storageKey)
    
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed?.access_token && parsed?.expires_at) {
        const expiresAt = parsed.expires_at * 1000
        const now = Date.now()
        if (expiresAt > now) {
          return {
            access_token: parsed.access_token,
            refresh_token: parsed.refresh_token,
            expires_at: parsed.expires_at,
            user: parsed.user
          }
        }
      }
    }
  } catch (error) {
    // Ignore storage errors
  }
  return null
}

/**
 * Check if session is expired or close to expiring (within 2 minutes)
 */
function isSessionExpiringSoon(session: any): boolean {
  if (!session?.expires_at) return true
  
  const expiresAt = session.expires_at * 1000
  const now = Date.now()
  const twoMinutes = 2 * 60 * 1000
  
  return (expiresAt - now) < twoMinutes
}

/**
 * Get session - FAST approach: localStorage first, then API
 * Returns session instantly from cache/storage if available
 */
async function getSessionFast(supabase: any): Promise<any> {
  // 1. Check in-memory cache first (instant)
  const now = Date.now()
  if (cachedSession && (now - cacheTimestamp) < CACHE_DURATION) {
    const expiresAt = cachedSession.expires_at * 1000
    if (expiresAt > now) {
      console.log('⚡ [AuthenticatedFetch] Using in-memory cached session')
      return {
        data: { session: cachedSession },
        error: null
      }
    }
  }
  
  // 2. Check localStorage (instant, synchronous)
  const storageSession = getSessionFromStorage()
  if (storageSession) {
    console.log('⚡ [AuthenticatedFetch] Using localStorage session')
    // Update cache
    cachedSession = storageSession
    cacheTimestamp = now
    return {
      data: { session: storageSession },
      error: null
    }
  }
  
  // 3. Fallback to API (only if storage is empty/expired)
  console.log('🔍 [AuthenticatedFetch] No cached session, fetching from API...')
  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise<{ data: { session: null }, error: { message: string } }>((_, reject) => 
        setTimeout(() => reject(new Error('Session retrieval timeout')), 2000)
      )
    ])
    
    if (result?.data?.session?.access_token) {
      // Update cache
      cachedSession = result.data.session
      cacheTimestamp = now
    }
    
    return result
  } catch (error: any) {
    console.warn('⚠️ [AuthenticatedFetch] API call failed, no session available')
    return { data: { session: null }, error: { message: error.message } }
  }
}

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
    // On timeout, return null instead of throwing - let caller use existing session
    console.warn('⚠️ [AuthenticatedFetch] Session refresh timed out, will use existing session')
    return { data: { session: null }, error: { message: 'Session refresh timeout' } }
  }
}

/**
 * Refresh session proactively if needed - FAST version
 * Uses cached session immediately, refreshes in background if needed
 */
async function ensureValidSession(supabase: any): Promise<any> {
  // Get session fast (localStorage first, then API)
  const { data: { session: currentSession }, error: sessionError } = await getSessionFast(supabase)
  
  if (sessionError) {
    console.warn(`⚠️ [AuthenticatedFetch] Error getting session:`, sessionError.message)
  }
  
  if (currentSession?.access_token) {
    // If session is expiring soon, refresh in background (non-blocking)
    if (isSessionExpiringSoon(currentSession)) {
      console.log('🔄 [AuthenticatedFetch] Session expiring soon, refreshing in background...')
      // Refresh in background - don't wait
      refreshSessionWithTimeout(supabase, 5000).then(({ data: { session: refreshedSession }, error: refreshError }) => {
        if (!refreshError && refreshedSession?.access_token) {
          // Update cache with new session
          cachedSession = refreshedSession
          cacheTimestamp = Date.now()
          console.log('✅ [AuthenticatedFetch] Session refreshed in background')
        }
      }).catch(() => {
        // Ignore background refresh errors
      })
    }
    
    // Return current session immediately (don't wait for refresh)
    return currentSession
  }
  
  return null
}

/**
 * Fetch with timeout using AbortController
 */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 30000): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    console.warn(`⏱️ [AuthenticatedFetch] Request timeout after ${timeoutMs}ms for ${url}`)
    controller.abort()
  }, timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (error: any) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`)
    }
    throw error
  }
}

/**
 * Fetch with authentication token
 * Automatically includes the user's session token in the Authorization header
 * Handles session refresh when tab becomes visible again
 * Includes timeout handling to prevent hanging requests
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const startTime = Date.now()
  
  try {
    const supabase = createClient()
    
    // Get session fast (localStorage/cache first)
    let session = await ensureValidSession(supabase)
    
    if (!session?.access_token) {
      console.error('❌ [AuthenticatedFetch] No session or access token found')
      const errorBody = JSON.stringify({ error: 'No authentication token available. Please log in again.' })
      return new Response(errorBody, {
        status: 401,
        statusText: 'Unauthorized',
        headers: { 
          'Content-Type': 'application/json',
          'Content-Length': errorBody.length.toString()
        }
      })
    }
    
    const headers = new Headers(options.headers)
    headers.set('Authorization', `Bearer ${session.access_token}`)
    
    // Make fetch request with timeout - longer timeout for publications API
    const timeoutMs = url.includes('/api/publications') ? 60000 : 30000 // 60s for publications, 30s for others
    const response = await fetchWithTimeout(url, {
      ...options,
      headers,
    }, timeoutMs)
    
    const elapsed = Date.now() - startTime
    if (elapsed > 1000) {
      console.log(`✅ [AuthenticatedFetch] Response in ${elapsed}ms: ${response.status}`)
    }
    
    // If we get a 401, the session might be expired - try to refresh
    if (response.status === 401) {
      console.log('⚠️ [AuthenticatedFetch] Got 401, refreshing session...')
      // Clear cache on 401
      cachedSession = null
      cacheTimestamp = 0
      
      try {
        const { data: { session: newSession }, error: refreshError } = await refreshSessionWithTimeout(supabase, 5000)
        
        if (!refreshError && newSession?.access_token) {
          // Update cache
          cachedSession = newSession
          cacheTimestamp = Date.now()
          // Retry with new token
          headers.set('Authorization', `Bearer ${newSession.access_token}`)
          const retryTimeoutMs = url.includes('/api/publications') ? 60000 : 30000
          return fetchWithTimeout(url, {
            ...options,
            headers,
          }, retryTimeoutMs)
        }
      } catch (refreshErr: any) {
        // Ignore refresh errors
      }
    }
    
    return response
  } catch (error: any) {
    // If it's a timeout, return a proper error response
    if (error.message?.includes('timeout')) {
      const errorBody = JSON.stringify({ error: 'Request timeout. Please try again.' })
      return new Response(errorBody, {
        status: 408,
        statusText: 'Request Timeout',
        headers: { 
          'Content-Type': 'application/json',
          'Content-Length': errorBody.length.toString()
        }
      })
    }
    
    const errorBody = JSON.stringify({ error: error.message || 'Unexpected error during fetch' })
    return new Response(errorBody, {
      status: 500,
      statusText: 'Internal Server Error',
      headers: { 
        'Content-Type': 'application/json',
        'Content-Length': errorBody.length.toString()
      }
    })
  }
}

/**
 * Clear session cache (useful on logout)
 */
export function clearSessionCache() {
  cachedSession = null
  cacheTimestamp = 0
}

/**
 * Check if we should redirect to login on 401 error
 * Only redirect if localStorage doesn't have a valid session
 */
export function shouldRedirectToLogin(): boolean {
  try {
    const projectRef = getProjectRef()
    const storageKey = `sb-${projectRef}-auth-token`
    const stored = localStorage.getItem(storageKey)
    
    if (stored) {
      const parsed = JSON.parse(stored)
      if (parsed?.access_token && parsed?.expires_at) {
        const expiresAt = parsed.expires_at * 1000
        const now = Date.now()
        if (expiresAt > now) {
          console.log('✅ [AuthenticatedFetch] Valid session in localStorage, not redirecting to login')
          return false
        }
      }
    }
  } catch (error) {
    // Ignore storage errors
  }
  
  console.log('⚠️ [AuthenticatedFetch] No valid localStorage session, should redirect to login')
  return true
}

