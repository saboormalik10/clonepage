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
    const result = await retryWithBackoff(
      async () => await adminClient
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single()
    )
    
    const profile = result?.data

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

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('global_price_adjustments')
      .select('*')
      .order('table_name', { ascending: true })

    if (error) throw error

    return NextResponse.json({ adjustments: data || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { isAdmin, userId } = await checkAdmin(request)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { table_name, adjustment_percentage, exact_amount, min_price, max_price } = body

    if (!table_name || (adjustment_percentage === undefined && exact_amount === undefined)) {
      return NextResponse.json({ error: 'Table name and either adjustment percentage or exact amount is required' }, { status: 400 })
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

    // Insert new global adjustment (allows multiple adjustments per table) with retry
    const { data, error } = await retryWithBackoff(
      async () => await adminClient
        .from('global_price_adjustments')
        .insert({
          table_name,
          adjustment_percentage: finalAdjustmentPercentage,
          exact_amount: finalExactAmount,
          min_price: min_price ? parseFloat(min_price) : null,
          max_price: max_price ? parseFloat(max_price) : null,
          applied_by: userId,
          updated_at: new Date().toISOString()
        })
        .select()
    )

    if (error) throw error

    // Prices will be adjusted when fetched via API routes
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
    const tableName = searchParams.get('table_name')

    // Support both ID-based deletion (for specific adjustment) and table_name-based deletion (for all adjustments in a table)
    if (!adjustmentId && !tableName) {
      return NextResponse.json({ error: 'Adjustment ID or table name is required' }, { status: 400 })
    }

    const adminClient = getAdminClient()

    // Delete the adjustment record(s) (prices will automatically revert when fetched) with retry
    let query = adminClient.from('global_price_adjustments').delete()
    
    if (adjustmentId) {
      query = query.eq('id', adjustmentId)
    } else if (tableName) {
      query = query.eq('table_name', tableName)
    }

    const { error } = await retryWithBackoff(async () => await query)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

