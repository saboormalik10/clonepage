import { NextResponse } from 'next/server'
import { getSupabaseClient } from './supabase'
import { getAdminClient, retryWithBackoff } from './admin-client'

/**
 * Get authenticated user from request
 * Returns user info if authenticated, null otherwise
 */
export async function getAuthenticatedUser(request: Request): Promise<{
  userId: string
  email: string
  role: string
} | null> {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader) {
      console.log('⚠️ [Auth] No authorization header found')
      return null
    }

    const token = authHeader.replace('Bearer ', '').trim()
    
    if (!token) {
      console.log('⚠️ [Auth] Empty token after Bearer prefix')
      return null
    }

    // Use admin client to validate token (bypasses RLS and works reliably)
    const adminClient = getAdminClient()
    
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token)

    if (userError) {
      console.error('⚠️ [Auth] Error validating token:', userError.message)
      return null
    }

    if (!user) {
      console.log('⚠️ [Auth] No user found for token')
      return null
    }

    // Get user profile to check role (using admin client to bypass RLS)
    const { data: profile, error: profileError } = await adminClient
      .from('user_profiles')
      .select('id, email, role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('⚠️ [Auth] Error fetching profile:', profileError.message)
      return null
    }

    if (!profile) {
      console.log('⚠️ [Auth] No profile found for user')
      return null
    }

    return {
      userId: user.id,
      email: profile.email,
      role: profile.role
    }
  } catch (error: any) {
    console.error('❌ [Auth] Error in getAuthenticatedUser:', error?.message || error)
    return null
  }
}

/**
 * Check if user is admin
 * Uses admin client to bypass RLS
 */
export async function checkAdmin(request: Request): Promise<{
  isAdmin: boolean
  userId: string | null
}> {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader) {
    return { isAdmin: false, userId: null }
  }

  const token = authHeader.replace('Bearer ', '')
  
  try {
    const adminClient = getAdminClient()
    
    const { data: { user }, error } = await retryWithBackoff(
      () => adminClient.auth.getUser(token)
    )

    if (error || !user) {
      return { isAdmin: false, userId: null }
    }

    const { data: profile } = await retryWithBackoff(
      () => adminClient
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()
    )

    return {
      isAdmin: profile?.role === 'admin',
      userId: user.id
    }
  } catch (error: any) {
    console.error('Error in checkAdmin:', error)
    return { isAdmin: false, userId: null }
  }
}

/**
 * Require authentication middleware
 * Returns user if authenticated, otherwise returns 401 response
 */
export async function requireAuth(request: Request): Promise<{
  userId: string
  email: string
  role: string
} | NextResponse> {
  const user = await getAuthenticatedUser(request)
  
  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    )
  }

  return user
}

/**
 * Require admin role middleware
 * Returns user if admin, otherwise returns 403 response
 */
export async function requireAdmin(request: Request): Promise<{
  isAdmin: boolean
  userId: string | null
} | NextResponse> {
  const { isAdmin, userId } = await checkAdmin(request)
  
  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Admin access required' },
      { status: 403 }
    )
  }

  return { isAdmin: true, userId }
}

