import { createClient } from '@supabase/supabase-js'

/**
 * Get admin client with service role key and timeout configuration
 * Includes retry logic for connection timeouts
 */
export function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase service role key')
  }

  // Custom fetch with timeout for Node.js environment
  const fetchWithTimeout = async (url: string | URL | Request, options: RequestInit = {}) => {
    const timeout = 30000 // 30 seconds
    
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      })
      return response
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`)
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    global: {
      fetch: fetchWithTimeout
    }
  })
}

/**
 * Retry a function with exponential backoff
 * Only retries on network/timeout errors, not on authentication or validation errors
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  initialDelay = 1000
): Promise<T> {
  let lastError: any

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      lastError = error

      // Don't retry on authentication/authorization errors
      if (
        error?.code === 'PGRST116' || // Not found
        error?.status === 401 || // Unauthorized
        error?.status === 403 || // Forbidden
        error?.status === 400 || // Bad Request
        error?.message?.includes('Unauthorized') ||
        error?.message?.includes('Forbidden')
      ) {
        throw error
      }

      // Only retry on network/timeout errors
      const isNetworkError = 
        error?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        error?.code === 'ECONNREFUSED' ||
        error?.code === 'ETIMEDOUT' ||
        error?.message?.includes('timeout') ||
        error?.message?.includes('fetch failed') ||
        error?.message?.includes('network') ||
        error?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        error?.cause?.code === 'ECONNREFUSED' ||
        error?.cause?.code === 'ETIMEDOUT'

      if (isNetworkError && attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt)
        console.warn(`⚠️ [Admin Client] Network error, retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms:`, error.message || error.code)
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      // For non-network errors or final attempt, throw immediately
      throw error
    }
  }

  throw lastError
}

