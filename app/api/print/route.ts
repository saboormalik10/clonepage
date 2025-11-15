import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import printData from '@/data/printData.json'
import { getPriceAdjustments, adjustPrintMagazines } from '@/lib/price-adjustments'
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
        data = await fetchAllRecords(supabase, 'print', {
          orderBy: 'category',
          ascending: true
        })
      } catch (error) {
        console.error('❌ [Print API] Supabase query error:', error)
      }

      if (data && data.length > 0) {
        console.log(`✅ [Print API] Loaded ${data.length} print categories from Supabase`)
        // Transform to match expected format and include id
        let transformedData = data.map((item: any) => ({
          id: item.id,
          category: item.category,
          magazines: item.magazines || []
        }))

        // Apply price adjustments
        let adjustments: any = null
        try {
          adjustments = await getPriceAdjustments(userId, 'print')
          console.log(`💰 [Print API] Price adjustments fetched:`, adjustments)
          // Always apply adjustments (even if 0) to ensure consistency
          transformedData = transformedData.map((item: any) => ({
            ...item,
            magazines: adjustPrintMagazines(item.magazines, adjustments)
          }))
          console.log(`✅ [Print API] Applied price adjustments to ${transformedData.length} categories`)
        } catch (adjError) {
          console.warn('⚠️ [Print API] Error applying price adjustments:', adjError)
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
    console.log(`⚠️ [Print API] Using JSON fallback (Supabase not configured or query failed)`)
    return NextResponse.json(printData)
  } catch (error) {
    console.error('❌ [Print API] Error fetching print data:', error)
    console.log(`⚠️ [Print API] Falling back to JSON file`)
    // Fallback to JSON file on error
    return NextResponse.json(printData)
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
    console.log('📝 [Print API] Updating record:', body)

    if (!body.id) {
      return NextResponse.json({ error: 'Record ID is required' }, { status: 400 })
    }

    // Validate required fields
    if (!body.category) {
      return NextResponse.json({ error: 'Category is required' }, { status: 400 })
    }

    // Transform data for database
    const recordData = {
      category: body.category,
      magazines: body.magazines || []
    }

    const { data, error } = await supabase
      .from('print')
      .update(recordData)
      .eq('id', body.id)
      .select()

    if (error) {
      console.error('❌ [Print API] Error updating record:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }

    console.log('✅ [Print API] Record updated successfully:', data[0])
    return NextResponse.json({ success: true, data: data[0] })
  } catch (error: any) {
    console.error('❌ [Print API] Error in PUT:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

