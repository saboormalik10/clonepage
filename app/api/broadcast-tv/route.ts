import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getAdminClient } from '@/lib/admin-client'
import tableData from '@/data/tableData.json'
import { getPriceAdjustments, adjustDollarPrice } from '@/lib/price-adjustments'
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
        data = await fetchAllRecords(supabase, 'broadcast_tv', {
          orderBy: 'affiliate',
          ascending: true
        })
      } catch (error) {
        console.error('❌ [Broadcast TV API] Supabase query error:', error)
      }

      if (data && data.length > 0) {
        // Transform snake_case to camelCase and include id
        let transformedData = data.map((item: any) => ({
          id: item.id,
          affiliate: item.affiliate,
          calls: item.calls,
          state: item.state,
          market: item.market,
          program: item.program,
          location: item.location,
          time: item.time,
          rate: item.rate,
          exampleUrl: item.example_url,
          intakeUrl: item.intake_url
        }))

        // Apply price adjustments
        let adjustments: any = null
        try {
          adjustments = await getPriceAdjustments(userId, 'broadcast_tv')
          // Always apply adjustments (even if 0) to ensure consistency
          transformedData = transformedData.map((item: any) => ({
            ...item,
            rate: adjustDollarPrice(item.rate, adjustments)
          }))
        } catch (adjError) {
          console.warn('⚠️ [Broadcast TV API] Error applying price adjustments:', adjError)
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
    
    // Apply price adjustments to fallback data too
    let adjustments: any = null
    try {
      adjustments = await getPriceAdjustments(userId, 'broadcast_tv')
    } catch (adjError) {
      console.warn('⚠️ [Broadcast TV API] Error applying price adjustments to fallback:', adjError)
    }

    // Include adjustments in response for consistency
    const result = {
      data: tableData,
      priceAdjustments: adjustments
    }
    return NextResponse.json(result)
  } catch (error) {
    console.error('❌ [Broadcast TV API] Error fetching broadcast TV:', error)
    
    // Apply price adjustments to error fallback data too
    let adjustments: any = null
    try {
      adjustments = await getPriceAdjustments(userId, 'broadcast_tv')
    } catch (adjError) {
      console.warn('⚠️ [Broadcast TV API] Error applying price adjustments to error fallback:', adjError)
    }

    // Include adjustments in response for consistency
    const result = {
      data: tableData,
      priceAdjustments: adjustments
    }
    return NextResponse.json(result)
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
    console.log('📝 [Broadcast TV API] Creating new record:', body)

    // Validate required fields
    if (!body.affiliate) {
      return NextResponse.json({ error: 'Affiliate is required' }, { status: 400 })
    }

    // Transform camelCase to snake_case for database
    const recordData = {
      affiliate: body.affiliate,
      calls: body.calls || null,
      state: body.state || null,
      market: body.market || null,
      program: body.program || null,
      location: body.location || null,
      time: body.time || null,
      rate: body.rate || null,
      example_url: body.exampleUrl || null,
      intake_url: body.intakeUrl || null
    }

    const { data, error } = await supabase
      .from('broadcast_tv')
      .insert([recordData])
      .select()

    if (error) {
      console.error('❌ [Broadcast TV API] Error creating record:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ [Broadcast TV API] Record created successfully:', data[0])
    return NextResponse.json({ success: true, data: data[0] })
  } catch (error: any) {
    console.error('❌ [Broadcast TV API] Error in POST:', error)
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
    console.log('📝 [Broadcast TV API] Updating record:', body)

    if (!body.id) {
      return NextResponse.json({ error: 'Record ID is required' }, { status: 400 })
    }

    // Transform camelCase to snake_case for database
    const recordData = {
      affiliate: body.affiliate,
      calls: body.calls || null,
      state: body.state || null,
      market: body.market || null,
      program: body.program || null,
      location: body.location || null,
      time: body.time || null,
      rate: body.rate || null,
      example_url: body.exampleUrl || null,
      intake_url: body.intakeUrl || null
    }

    const { data, error } = await supabase
      .from('broadcast_tv')
      .update(recordData)
      .eq('id', body.id)
      .select()

    if (error) {
      console.error('❌ [Broadcast TV API] Error updating record:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }

    console.log('✅ [Broadcast TV API] Record updated successfully:', data[0])
    return NextResponse.json({ success: true, data: data[0] })
  } catch (error: any) {
    console.error('❌ [Broadcast TV API] Error in PUT:', error)
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

    console.log('🗑️ [Broadcast TV API] Deleting record with ID:', id)

    // Use admin client to bypass RLS policies for delete operation
    const adminClient = getAdminClient()

    const { data, error } = await adminClient
      .from('broadcast_tv')
      .delete()
      .eq('id', id)
      .select()

    if (error) {
      console.error('❌ [Broadcast TV API] Error deleting record:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }

    console.log('✅ [Broadcast TV API] Record deleted successfully:', data[0])
    return NextResponse.json({ success: true, data: data[0] })
  } catch (error: any) {
    console.error('❌ [Broadcast TV API] Error in DELETE:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

