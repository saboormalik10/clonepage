import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
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
        console.log(`✅ [Broadcast TV API] Loaded ${data.length} broadcast TV entries from Supabase`)
        // Transform snake_case to camelCase
        let transformedData = data.map((item: any) => ({
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
        try {
          const adjustments = await getPriceAdjustments(userId, 'broadcast_tv')
          console.log(`💰 [Broadcast TV API] Price adjustments fetched: Global ${adjustments.global}%, User ${adjustments.user}%, Total ${adjustments.total}%`)
          // Always apply adjustments (even if 0) to ensure consistency
          transformedData = transformedData.map((item: any) => ({
            ...item,
            rate: adjustDollarPrice(item.rate, adjustments)
          }))
          if (adjustments.total !== 0) {
            console.log(`✅ [Broadcast TV API] Applied price adjustments to ${transformedData.length} items`)
          } else {
            console.log(`ℹ️ [Broadcast TV API] Price adjustments applied (all adjustments are 0, no change)`)
          }
        } catch (adjError) {
          console.warn('⚠️ [Broadcast TV API] Error applying price adjustments:', adjError)
        }

        return NextResponse.json(transformedData)
      }
    }

    // Fallback to JSON file if Supabase is not configured or query failed
    console.log(`⚠️ [Broadcast TV API] Using JSON fallback (Supabase not configured or query failed)`)
    return NextResponse.json(tableData)
  } catch (error) {
    console.error('❌ [Broadcast TV API] Error fetching broadcast TV:', error)
    console.log(`⚠️ [Broadcast TV API] Falling back to JSON file`)
    // Fallback to JSON file on error
    return NextResponse.json(tableData)
  }
}

