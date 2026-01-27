import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/admin-client'

// Get the authenticated user from the token
async function getAuthenticatedUser(request: Request) {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader) {
    return { user: null, error: 'No authorization header' }
  }

  const token = authHeader.replace('Bearer ', '')
  
  try {
    const adminClient = getAdminClient()
    
    const { data: { user }, error } = await adminClient.auth.getUser(token)

    if (error || !user) {
      return { user: null, error: 'Invalid token or user not found' }
    }

    return { user, error: null }
  } catch (error: any) {
    console.error('Error getting authenticated user:', error)
    return { user: null, error: error.message }
  }
}

// GET - Fetch user profile
export async function GET(request: Request) {
  try {
    const { user, error: authError } = await getAuthenticatedUser(request)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = getAdminClient()
    
    const { data: profile, error } = await adminClient
      .from('user_profiles')
      .select('id, email, full_name, role, brand_name, brand_logo')
      .eq('id', user.id)
      .single()

    if (error) {
      console.error('Error fetching profile:', error)
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
    }

    return NextResponse.json({ profile })
  } catch (error: any) {
    console.error('Error in GET /api/user/profile:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT - Update user profile (brand name and logo)
export async function PUT(request: Request) {
  try {
    const { user, error: authError } = await getAuthenticatedUser(request)
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { brand_name, brand_logo } = body

    const adminClient = getAdminClient()
    
    // Update the user profile
    const { data, error } = await adminClient
      .from('user_profiles')
      .update({
        brand_name: brand_name || null,
        brand_logo: brand_logo || null,
      })
      .eq('id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating profile:', error)
      return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Profile updated successfully',
      profile: data 
    })
  } catch (error: any) {
    console.error('Error in PUT /api/user/profile:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
