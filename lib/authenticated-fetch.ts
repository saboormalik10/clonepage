import { createClient } from './supabase-client'

/**
 * Fetch with authentication token
 * Automatically includes the user's session token in the Authorization header
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  try {
    const supabase = createClient()
    
    // Try to get session with retries (in case session is still being established)
    let session = null
    let attempts = 0
    const maxAttempts = 5  // Increased retries
    
    while (!session && attempts < maxAttempts) {
      try {
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.warn(`⚠️ [AuthenticatedFetch] Error getting session (attempt ${attempts + 1}/${maxAttempts}):`, sessionError.message)
        }
        
        if (currentSession?.access_token) {
          session = currentSession
          console.log(`✅ [AuthenticatedFetch] Session found on attempt ${attempts + 1} for URL: ${url}`)
          break
        } else {
          console.log(`ℹ️ [AuthenticatedFetch] No session yet (attempt ${attempts + 1}/${maxAttempts})`)
        }
      } catch (err: any) {
        console.warn(`⚠️ [AuthenticatedFetch] Exception getting session (attempt ${attempts + 1}):`, err.message)
      }
      
      attempts++
      if (attempts < maxAttempts) {
        // Wait a bit before retrying (session might still be establishing)
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }
    
    if (!session?.access_token) {
      console.error('❌ [AuthenticatedFetch] No session or access token found after all retries')
      // Return a proper fetch Response that can be read
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
    
    const response = await fetch(url, {
      ...options,
      headers,
    })
    
    // If we get a 401, the session might be expired - try to refresh
    if (response.status === 401) {
      console.log('⚠️ [AuthenticatedFetch] Got 401, attempting to refresh session...')
      try {
        const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession()
        
        if (!refreshError && newSession?.access_token) {
          console.log('✅ [AuthenticatedFetch] Session refreshed, retrying request...')
          // Retry with new token
          headers.set('Authorization', `Bearer ${newSession.access_token}`)
          return fetch(url, {
            ...options,
            headers,
          })
        } else {
          console.error('⚠️ [AuthenticatedFetch] Failed to refresh session:', refreshError?.message)
        }
      } catch (refreshErr: any) {
        console.error('⚠️ [AuthenticatedFetch] Exception refreshing session:', refreshErr.message)
      }
    }
    
    return response
  } catch (error: any) {
    console.error('❌ [AuthenticatedFetch] Unexpected error:', error)
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

