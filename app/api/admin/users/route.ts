import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'
import { getAdminClient, retryWithBackoff } from '@/lib/admin-client'

// Check if user is admin
async function checkAdmin(request: Request) {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader) {
    return { isAdmin: false, userId: null }
  }

  const token = authHeader.replace('Bearer ', '')
  
  try {
    // Use admin client with retry logic to bypass RLS when checking admin status
    const adminClient = getAdminClient()
    
    const { data: { user }, error } = await retryWithBackoff(
      () => adminClient.auth.getUser(token)
    )

    if (error || !user) {
      return { isAdmin: false, userId: null }
    }

    // Use admin client to query profile (bypasses RLS) with retry
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

export async function GET(request: Request) {
  try {
    const { isAdmin } = await checkAdmin(request)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use admin client to ensure we get all users (bypasses RLS) with retry
    const adminClient = getAdminClient()
    const { data, error } = await retryWithBackoff(
      () => adminClient
        .from('user_profiles')
        .select('*')
        .neq('role', 'admin') // Exclude admin users from listings
        .order('created_at', { ascending: false })
    )

    if (error) throw error

    return NextResponse.json({ users: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { isAdmin } = await checkAdmin(request)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { email, password, full_name, role } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const adminClient = getAdminClient()

    // Create user in auth with retry
    const { data: authData, error: authError } = await retryWithBackoff(
      () => adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
    )

    if (authError) throw authError

    if (!authData.user) {
      throw new Error('Failed to create user')
    }

    // Check if profile exists, if not create it, otherwise update it with retry
    const { data: existingProfile } = await retryWithBackoff(
      () => adminClient
        .from('user_profiles')
        .select('id')
        .eq('id', authData.user.id)
        .single()
    )

    if (existingProfile) {
      // Profile exists, update it with retry
      const { error: profileError } = await retryWithBackoff(
        () => adminClient
          .from('user_profiles')
          .update({
            role: role || 'user',
            full_name: full_name || null,
          })
          .eq('id', authData.user.id)
      )

      if (profileError) throw profileError
    } else {
      // Profile doesn't exist, create it with retry
      const { error: profileError } = await retryWithBackoff(
        () => adminClient
          .from('user_profiles')
          .insert({
            id: authData.user.id,
            email: email,
            role: role || 'user',
            full_name: full_name || null,
          })
      )

      if (profileError) throw profileError
    }

    return NextResponse.json({ 
      success: true, 
      user: { id: authData.user.id, email, role: role || 'user' } 
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { isAdmin } = await checkAdmin(request)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const adminClient = getAdminClient()
    const { error } = await retryWithBackoff(
      () => adminClient.auth.admin.deleteUser(userId)
    )

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}


