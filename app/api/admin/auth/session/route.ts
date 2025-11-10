import { NextResponse } from 'next/server'
import { getAdminClient, retryWithBackoff } from '@/lib/admin-client'

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')
    
    if (!authHeader) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    // Use admin client with retry to bypass RLS when checking admin status
    const adminClient = getAdminClient()
    const token = authHeader.replace('Bearer ', '')
    
    const { data: { user }, error } = await retryWithBackoff(
      () => adminClient.auth.getUser(token)
    )

    if (error || !user) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    // Check if user is admin (using admin client to bypass RLS) with retry
    const result = await retryWithBackoff(
      async () => await adminClient
        .from('user_profiles')
        .select('id, email, role')
        .eq('id', user.id)
        .single()
    )
    
    const profile = result?.data

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ authenticated: false }, { status: 403 })
    }

    return NextResponse.json({ 
      authenticated: true, 
      user: {
        id: user.id,
        email: user.email,
        role: profile.role
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}


