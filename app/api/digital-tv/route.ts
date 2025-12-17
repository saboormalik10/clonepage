import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'
import { getAdminClient } from '@/lib/admin-client'
import digitalTvData from '@/data/digitalTvData.json'
import { createFreshResponse, routeConfig } from '@/lib/api-helpers'
import { getPriceAdjustments, adjustDollarPrice } from '@/lib/price-adjustments'
import { requireAuth } from '@/lib/auth-middleware'
import { fetchAllRecords } from '@/lib/supabase-helpers'
import { dataCache, CACHE_KEYS } from '@/lib/cache'

// Disable Next.js caching for this route
export const dynamic = routeConfig.dynamic
export const revalidate = routeConfig.revalidate

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
      
      // Check cache first
      const cachedData = dataCache.get<any[]>(CACHE_KEYS.DIGITAL_TV)
      if (cachedData) {
        data = cachedData
        console.log(`✅ [Digital TV API] Using cached data: ${data.length} records`)
      } else {
        try {
          const supabase = getSupabaseClient()
          data = await fetchAllRecords(supabase, 'digital_tv', {
            orderBy: 'station',
            ascending: true
          })
          // Cache the data
          dataCache.set(CACHE_KEYS.DIGITAL_TV, data)
          console.log(`✅ [Digital TV API] Fetched ${data.length} records from Supabase and cached`)
        } catch (error) {
          console.error('❌ [Digital TV API] Supabase query error:', error)
        }
      }

      if (data && data.length > 0) {
        // Transform snake_case to camelCase and include id
        let transformedData = data.map((item: any) => ({
          id: item.id,
          callSign: item.call_sign,
          station: item.station,
          rate: item.rate,
          tat: item.tat,
          sponsored: item.sponsored,
          indexed: item.indexed,
          segmentLength: item.segment_length,
          location: item.location,
          programName: item.program_name,
          interviewType: item.interview_type,
          exampleUrl: item.example_url
        }))

        // Apply price adjustments
        let adjustments: any = null
        try {
          adjustments = await getPriceAdjustments(userId, 'digital_tv')
          // Always apply adjustments (even if 0) to ensure consistency
          transformedData = transformedData.map((item: any) => ({
            ...item,
            rate: adjustDollarPrice(item.rate, adjustments)
          }))
        } catch (adjError) {
          console.warn('⚠️ [Digital TV API] Error applying price adjustments:', adjError)
        }

        // Include adjustments in response
        const result = {
          data: transformedData,
          priceAdjustments: adjustments
        }
        return createFreshResponse(result)
      }
    }

    // Fallback to JSON file if Supabase is not configured or query fails
    return createFreshResponse(digitalTvData)
  } catch (error) {
    console.error('❌ [Digital TV API] Error fetching digital TV:', error)
    // Fallback to JSON file on error
    return createFreshResponse(digitalTvData)
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
    console.log('📝 [Digital TV API] Creating new record:', body)

    // Validate required fields
    if (!body.station) {
      return NextResponse.json({ error: 'Station is required' }, { status: 400 })
    }

    // Transform camelCase to snake_case for database
    const recordData = {
      call_sign: body.callSign || null,
      station: body.station,
      rate: body.rate || null,
      tat: body.tat || null,
      sponsored: body.sponsored || null,
      indexed: body.indexed || null,
      segment_length: body.segmentLength || null,
      location: body.location || null,
      program_name: body.programName || null,
      interview_type: body.interviewType || null,
      example_url: body.exampleUrl || null
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('digital_tv')
      .insert([recordData])
      .select()

    if (error) {
      console.error('❌ [Digital TV API] Error creating record:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log('✅ [Digital TV API] Record created successfully:', data[0])
    // Invalidate cache after insert
    dataCache.invalidate(CACHE_KEYS.DIGITAL_TV)
    return NextResponse.json({ success: true, data: data[0] })
  } catch (error: any) {
    console.error('❌ [Digital TV API] Error in POST:', error)
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
    console.log('📝 [Digital TV API] Updating record:', body)

    if (!body.id) {
      return NextResponse.json({ error: 'Record ID is required' }, { status: 400 })
    }

    // Transform camelCase to snake_case for database
    const recordData = {
      call_sign: body.callSign || null,
      station: body.station,
      rate: body.rate || null,
      tat: body.tat || null,
      sponsored: body.sponsored || null,
      indexed: body.indexed || null,
      segment_length: body.segmentLength || null,
      location: body.location || null,
      program_name: body.programName || null,
      interview_type: body.interviewType || null,
      example_url: body.exampleUrl || null
    }

    const supabase = getSupabaseClient()
    const { data, error } = await supabase
      .from('digital_tv')
      .update(recordData)
      .eq('id', body.id)
      .select()

    if (error) {
      console.error('❌ [Digital TV API] Error updating record:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }

    console.log('✅ [Digital TV API] Record updated successfully:', data[0])
    // Invalidate cache after update
    dataCache.invalidate(CACHE_KEYS.DIGITAL_TV)
    return NextResponse.json({ success: true, data: data[0] })
  } catch (error: any) {
    console.error('❌ [Digital TV API] Error in PUT:', error)
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

    console.log('🗑️ [Digital TV API] Deleting record with ID:', id)

    // Use admin client to bypass RLS policies for delete operation
    const adminClient = getAdminClient()

    const { data, error } = await adminClient
      .from('digital_tv')
      .delete()
      .eq('id', id)
      .select()

    if (error) {
      console.error('❌ [Digital TV API] Error deleting record:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }

    console.log('✅ [Digital TV API] Record deleted successfully:', data[0])
    // Invalidate cache after delete
    dataCache.invalidate(CACHE_KEYS.DIGITAL_TV)
    return NextResponse.json({ success: true, data: data[0] })
  } catch (error: any) {
    console.error('❌ [Digital TV API] Error in DELETE:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

