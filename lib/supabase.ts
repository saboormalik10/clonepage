import { createClient } from '@supabase/supabase-js'

/**
 * Get Supabase client instance
 * Creates a new client each time to ensure fresh environment variables
 */
export function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('⚠️ [Supabase] Environment variables are not set. Using fallback to JSON files.')
    console.warn('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌')
    console.warn('   NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅' : '❌')
  } else {
    console.log('✅ [Supabase] Client initialized with URL:', supabaseUrl.substring(0, 30) + '...')
  }

  // Create Supabase client without custom fetch override
  // The API response headers already handle cache control
  // Overriding fetch was breaking the API key header
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  })
}

// Export a default instance for backward compatibility
// But prefer using getSupabaseClient() in API routes
export const supabase = getSupabaseClient()




