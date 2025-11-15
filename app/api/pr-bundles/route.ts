import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getAdminClient } from '@/lib/admin-client'
import prBundlesData from '@/data/prBundlesData.json'
import { getPriceAdjustments, adjustPRBundles } from '@/lib/price-adjustments'
import { requireAuth } from '@/lib/auth-middleware'
import { fetchAllRecords } from '@/lib/supabase-helpers'

export async function GET(request: Request) {
  // Require authentication
  const authResult = await requireAuth(request)
  if (authResult instanceof Response) {
    return authResult // Return 401 if not authenticated
  }
  
  const userId = authResult.userId // Get userId from authenticated user
  
  try {
    // Try to fetch from Supabase first
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      let data: any[] = []
      try {
        data = await fetchAllRecords(supabase, 'pr_bundles', {
          orderBy: 'category',
          ascending: true
        })
      } catch (error) {
        console.error('❌ [PR Bundles API] Supabase query error:', error)
      }

      if (data && data.length > 0) {
        console.log(`✅ [PR Bundles API] Loaded ${data.length} PR bundle categories from Supabase`)
        // Transform to match expected format and include id
        let transformedData = data.map((item: any) => ({
          id: item.id,
          category: item.category,
          bundles: item.bundles || []
        }))

        // Apply price adjustments
        let adjustments: any = null
        try {
          adjustments = await getPriceAdjustments(userId, 'pr_bundles')
          console.log(`💰 [PR Bundles API] Price adjustments fetched:`, adjustments)
          // Always apply adjustments (even if 0) to ensure consistency
          transformedData = transformedData.map((item: any) => ({
            ...item,
            bundles: adjustPRBundles(item.bundles, adjustments)
          }))
          console.log(`✅ [PR Bundles API] Applied price adjustments to ${transformedData.length} categories`)
        } catch (adjError) {
          console.warn('⚠️ [PR Bundles API] Error applying price adjustments:', adjError)
        }

        // Include adjustments in response
        const result = {
          data: transformedData,
          priceAdjustments: adjustments
        }
        return NextResponse.json(result)
      }
    }

    // Fallback to JSON file if Supabase is not configured or query failed
    console.log(`⚠️ [PR Bundles API] Using JSON fallback (Supabase not configured or query failed)`)
    return NextResponse.json(prBundlesData)
  } catch (error) {
    console.error('❌ [PR Bundles API] Error fetching PR bundles:', error)
    console.log(`⚠️ [PR Bundles API] Falling back to JSON file`)
    // Fallback to JSON file on error
    return NextResponse.json(prBundlesData)
  }
}

export async function POST(request: Request) {
  // Require authentication
  const authResult = await requireAuth(request)
  if (authResult instanceof Response) {
    return authResult // Return 401 if not authenticated
  }

  try {
    const body = await request.json()
    console.log('📝 [PR Bundles API] Creating new record:', body)

    // Validate required fields
    if (!body.category) {
      return NextResponse.json({ error: 'Category is required' }, { status: 400 })
    }

    // Transform data for database
    const recordData = {
      category: body.category,
      bundles: body.bundles || []
    }

    const { data, error } = await supabase
      .from('pr_bundles')
      .insert([recordData])
      .select()

    if (error) {
      console.error('❌ [PR Bundles API] Error creating record:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ [PR Bundles API] Record created successfully:', data[0])
    return NextResponse.json({ success: true, data: data[0] })
  } catch (error: any) {
    console.error('❌ [PR Bundles API] Error in POST:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  // Require authentication
  const authResult = await requireAuth(request)
  if (authResult instanceof Response) {
    return authResult // Return 401 if not authenticated
  }

  try {
    const body = await request.json()
    console.log('📝 [PR Bundles API] Updating record:', body)

    if (!body.id) {
      return NextResponse.json({ error: 'Record ID is required' }, { status: 400 })
    }

    // Transform data for database
    const recordData = {
      category: body.category,
      bundles: body.bundles || []
    }

    const { data, error } = await supabase
      .from('pr_bundles')
      .update(recordData)
      .eq('id', body.id)
      .select()

    if (error) {
      console.error('❌ [PR Bundles API] Error updating record:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }

    console.log('✅ [PR Bundles API] Record updated successfully:', data[0])
    return NextResponse.json({ success: true, data: data[0] })
  } catch (error: any) {
    console.error('❌ [PR Bundles API] Error in PUT:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  // Require authentication
  const authResult = await requireAuth(request)
  if (authResult instanceof Response) {
    return authResult // Return 401 if not authenticated
  }

  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Record ID is required' }, { status: 400 })
    }

    console.log('🗑️ [PR Bundles API] Deleting record with ID:', id)

    // Use admin client to bypass RLS policies for delete operation
    const adminClient = getAdminClient()

    const { data, error } = await adminClient
      .from('pr_bundles')
      .delete()
      .eq('id', id)
      .select()

    if (error) {
      console.error('❌ [PR Bundles API] Error deleting record:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }

    console.log('✅ [PR Bundles API] Record deleted successfully:', data[0])
    return NextResponse.json({ success: true, data: data[0] })
  } catch (error: any) {
    console.error('❌ [PR Bundles API] Error in DELETE:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

