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
    const { table_name, adjustment_percentage } = body

    if (!table_name || adjustment_percentage === undefined) {
      return NextResponse.json({ error: 'Table name and adjustment percentage are required' }, { status: 400 })
    }

    if (!TABLES.includes(table_name)) {
      return NextResponse.json({ error: 'Invalid table name' }, { status: 400 })
    }

    const adminClient = getAdminClient()

    // Upsert global adjustment (only save in model, don't modify prices directly) with retry
    const { data, error } = await retryWithBackoff(
      async () => await adminClient
        .from('global_price_adjustments')
        .upsert({
          table_name,
          adjustment_percentage: parseFloat(adjustment_percentage),
          applied_by: userId,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'table_name'
        })
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
    const tableName = searchParams.get('table_name')

    if (!tableName) {
      return NextResponse.json({ error: 'Table name is required' }, { status: 400 })
    }

    const adminClient = getAdminClient()

    // Delete the adjustment record (prices will automatically revert when fetched) with retry
    const { error } = await retryWithBackoff(
      async () => await adminClient
        .from('global_price_adjustments')
        .delete()
        .eq('table_name', tableName)
    )

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

