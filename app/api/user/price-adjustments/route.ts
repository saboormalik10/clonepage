import { NextResponse } from 'next/server'
import { getAdminClient, retryWithBackoff } from '@/lib/admin-client'

const TABLES = ['publications', 'social_posts', 'digital_tv', 'best_sellers', 'listicles', 'pr_bundles', 'print', 'broadcast_tv', 'others']

async function getUserId(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader) {
    return null
  }

  const token = authHeader.replace('Bearer ', '')
  
  try {
    // Use admin client to validate token (bypasses RLS for auth check)
    const adminClient = getAdminClient()
    const { data: { user }, error } = await adminClient.auth.getUser(token)

    if (error || !user) {
      return null
    }

    return user.id
  } catch (error: any) {
    console.error('Error in getUserId:', error)
    return null
  }
}

export async function GET(request: Request) {
  try {
    const userId = await getUserId(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Use admin client but filter by user_id for security
    const adminClient = getAdminClient()
    
    // Fetch user's own adjustments
    const { data: adjustments, error: adjustmentsError } = await retryWithBackoff(
      async () => await adminClient
        .from('user_price_adjustments')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
    )

    if (adjustmentsError) {
      console.error('Error fetching adjustments:', adjustmentsError)
      throw adjustmentsError
    }

    return NextResponse.json({ adjustments: adjustments || [] })
  } catch (error: any) {
    console.error('Error in GET /api/user/price-adjustments:', error)
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      details: error.details || error.hint || null
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getUserId(request)
    
    if (!userId) {
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

    // Use admin client but ensure user_id matches authenticated user (application-level security)
    const adminClient = getAdminClient()

    // Insert new user adjustment (allows multiple adjustments per user/table) with retry
    const { data, error } = await retryWithBackoff(
      async () => await adminClient
        .from('user_price_adjustments')
        .insert({
          user_id: userId, // Explicitly set to authenticated user's ID
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
    const userId = await getUserId(request)
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const adjustmentId = searchParams.get('id')

    if (!adjustmentId) {
      return NextResponse.json({ error: 'Adjustment ID is required' }, { status: 400 })
    }
    
    // Use admin client but verify ownership
    const adminClient = getAdminClient()
    
    // First verify the adjustment belongs to this user
    const { data: adjustment, error: checkError } = await retryWithBackoff(
      async () => await adminClient
        .from('user_price_adjustments')
        .select('user_id')
        .eq('id', adjustmentId)
        .single()
    )

    if (checkError || !adjustment) {
      return NextResponse.json({ error: 'Adjustment not found' }, { status: 404 })
    }

    if (adjustment.user_id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Delete the adjustment (only if user_id matches)
    const { error } = await retryWithBackoff(
      async () => await adminClient
        .from('user_price_adjustments')
        .delete()
        .eq('id', adjustmentId)
        .eq('user_id', userId) // Double-check ownership
    )

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

