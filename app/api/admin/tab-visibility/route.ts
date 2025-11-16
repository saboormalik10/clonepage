import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getAdminClient } from '@/lib/admin-client'
import { requireAuth } from '@/lib/auth-middleware'

async function checkAdmin(request: Request) {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader) {
    return { isAdmin: false, userId: null }
  }

  const token = authHeader.replace('Bearer ', '')
  
  try {
    const adminClient = getAdminClient()
    const { data: { user }, error } = await adminClient.auth.getUser(token)
    
    if (error || !user) {
      return { isAdmin: false, userId: null }
    }

    const { data: profile } = await adminClient
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    return {
      isAdmin: profile?.role === 'admin',
      userId: user.id
    }
  } catch (error) {
    console.error('Error checking admin status:', error)
    return { isAdmin: false, userId: null }
  }
}

export async function GET(request: Request) {
  // Require authentication
  const authResult = await requireAuth(request)
  if (authResult instanceof Response) {
    return authResult // Return 401 if not authenticated
  }

  // Check if user is admin
  const { isAdmin } = await checkAdmin(request)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
  }

  try {
    const { data, error } = await supabase
      .from('tab_visibility')
      .select('*')
      .order('tab_id', { ascending: true })

    if (error) {
      console.error('❌ [Tab Visibility API] Error fetching tab visibility:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: data || [] })
  } catch (error: any) {
    console.error('❌ [Tab Visibility API] Error in GET:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  // Require authentication
  const authResult = await requireAuth(request)
  if (authResult instanceof Response) {
    return authResult // Return 401 if not authenticated
  }

  // Check if user is admin
  const { isAdmin } = await checkAdmin(request)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { tab_id, is_visible } = body

    if (!tab_id || typeof is_visible !== 'boolean') {
      return NextResponse.json({ error: 'tab_id and is_visible (boolean) are required' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('tab_visibility')
      .update({ is_visible })
      .eq('tab_id', tab_id)
      .select()
      .single()

    if (error) {
      console.error('❌ [Tab Visibility API] Error updating tab visibility:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('❌ [Tab Visibility API] Error in PUT:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  // Require authentication
  const authResult = await requireAuth(request)
  if (authResult instanceof Response) {
    return authResult // Return 401 if not authenticated
  }

  // Check if user is admin
  const { isAdmin } = await checkAdmin(request)
  if (!isAdmin) {
    return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { updates } = body // Array of { tab_id, is_visible }

    if (!Array.isArray(updates)) {
      return NextResponse.json({ error: 'updates array is required' }, { status: 400 })
    }

    // Update all tabs in a transaction
    console.log('💾 [Tab Visibility API] Updating tabs:', updates)
    const results = []
    for (const update of updates) {
      const { tab_id, is_visible } = update
      if (!tab_id || typeof is_visible !== 'boolean') {
        console.warn(`⚠️ [Tab Visibility API] Skipping invalid update:`, update)
        continue
      }

      const { data, error } = await supabase
        .from('tab_visibility')
        .update({ is_visible })
        .eq('tab_id', tab_id)
        .select()
        .single()

      if (error) {
        console.error(`❌ [Tab Visibility API] Error updating ${tab_id}:`, error)
        continue
      }

      console.log(`✅ [Tab Visibility API] Updated ${tab_id}: is_visible=${is_visible}`)
      results.push(data)
    }

    console.log(`✅ [Tab Visibility API] Successfully updated ${results.length} tabs`)
    return NextResponse.json({ success: true, data: results })
  } catch (error: any) {
    console.error('❌ [Tab Visibility API] Error in POST:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

