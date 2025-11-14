import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'
import { getAdminClient, retryWithBackoff } from '@/lib/admin-client'

const TABLES = ['publications', 'social_posts', 'digital_tv', 'best_sellers', 'listicles', 'pr_bundles', 'print', 'broadcast_tv']

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
    const profileResult = await retryWithBackoff(
      async () => await adminClient
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()
    )
    
    const profile = profileResult?.data

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

    // Use admin client to bypass RLS
    const adminClient = getAdminClient()
    
    // Fetch adjustments with retry
    const { data: adjustments, error: adjustmentsError } = await retryWithBackoff(
      async () => await adminClient
        .from('user_price_adjustments')
        .select('*')
        .order('created_at', { ascending: false })
    )

    if (adjustmentsError) {
      console.error('Error fetching adjustments:', adjustmentsError)
      throw adjustmentsError
    }

    if (!adjustments || adjustments.length === 0) {
      return NextResponse.json({ adjustments: [] })
    }

    // Get unique user IDs
    const userIds = Array.from(new Set(adjustments.map((adj: any) => adj.user_id)))
    
    // Fetch user profiles for these users with retry
    const { data: userProfiles, error: profilesError } = await retryWithBackoff(
      async () => await adminClient
        .from('user_profiles')
        .select('id, email, full_name, role')
        .in('id', userIds)
    )

    if (profilesError) {
      console.error('Error fetching user profiles:', profilesError)
      throw profilesError
    }

    // Create a map of user profiles by ID
    const userProfileMap = new Map(
      (userProfiles || []).map((profile: any) => [profile.id, profile])
    )

    // Join adjustments with user profiles and filter out admin users
    const filteredAdjustments = adjustments
      .map((adj: any) => ({
        ...adj,
        user_profiles: userProfileMap.get(adj.user_id) || null
      }))
      .filter((adj: any) => {
        return adj.user_profiles?.role !== 'admin'
      })

    return NextResponse.json({ adjustments: filteredAdjustments })
  } catch (error: any) {
    console.error('Error in GET /api/admin/prices/users:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      details: error.details || error.hint || null
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { isAdmin } = await checkAdmin(request)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { user_id, table_name, adjustment_percentage, exact_amount, min_price, max_price } = body

    if (!user_id || !table_name || (adjustment_percentage === undefined && exact_amount === undefined)) {
      return NextResponse.json({ error: 'User ID, table name and either adjustment percentage or exact amount is required' }, { status: 400 })
    }

    if (!TABLES.includes(table_name)) {
      return NextResponse.json({ error: 'Invalid table name' }, { status: 400 })
    }

    // If exact_amount is provided, set adjustment_percentage to 0 and use exact_amount
    // Otherwise, use adjustment_percentage and set exact_amount to null
    const finalAdjustmentPercentage = exact_amount !== undefined && exact_amount !== null && exact_amount !== '' 
      ? 0 
      : parseFloat(adjustment_percentage) || 0
    const finalExactAmount = exact_amount !== undefined && exact_amount !== null && exact_amount !== '' 
      ? parseFloat(exact_amount) 
      : null

    const adminClient = getAdminClient()

    // Insert new user adjustment (allows multiple adjustments per user/table) with retry
    const { data, error } = await retryWithBackoff(
      async () => await adminClient
        .from('user_price_adjustments')
        .insert({
          user_id,
          table_name,
          adjustment_percentage: finalAdjustmentPercentage,
          exact_amount: finalExactAmount,
          min_price: min_price ? parseFloat(min_price) : null,
          max_price: max_price ? parseFloat(max_price) : null,
          updated_at: new Date().toISOString()
        })
        .select()
    )

    if (error) throw error

    return NextResponse.json({ success: true, data })
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
    const adjustmentId = searchParams.get('id')

    if (!adjustmentId) {
      return NextResponse.json({ error: 'Adjustment ID is required' }, { status: 400 })
    }

    const adminClient = getAdminClient()
    const { error } = await retryWithBackoff(
      async () => await adminClient
        .from('user_price_adjustments')
        .delete()
        .eq('id', adjustmentId)
    )

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}


