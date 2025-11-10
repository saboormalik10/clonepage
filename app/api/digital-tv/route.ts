import { supabase } from '@/lib/supabase'
import digitalTvData from '@/data/digitalTvData.json'
import { createFreshResponse, routeConfig } from '@/lib/api-helpers'
import { getPriceAdjustments, adjustDollarPrice } from '@/lib/price-adjustments'
import { requireAuth } from '@/lib/auth-middleware'
import { fetchAllRecords } from '@/lib/supabase-helpers'

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
      try {
        data = await fetchAllRecords(supabase, 'digital_tv', {
          orderBy: 'station',
          ascending: true
        })
      } catch (error) {
        console.error('❌ [Digital TV API] Supabase query error:', error)
      }

      if (data && data.length > 0) {
        console.log(`✅ [Digital TV API] Loaded ${data.length} digital TV entries from Supabase`)
        // Transform snake_case to camelCase
        let transformedData = data.map((item: any) => ({
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
        try {
          const adjustments = await getPriceAdjustments(userId, 'digital_tv')
          console.log(`💰 [Digital TV API] Price adjustments fetched: Global ${adjustments.global}%, User ${adjustments.user}%, Total ${adjustments.total}%`)
          // Always apply adjustments (even if 0) to ensure consistency
          transformedData = transformedData.map((item: any) => ({
            ...item,
            rate: adjustDollarPrice(item.rate, adjustments)
          }))
          if (adjustments.total !== 0) {
            console.log(`✅ [Digital TV API] Applied price adjustments to ${transformedData.length} items`)
          } else {
            console.log(`ℹ️ [Digital TV API] Price adjustments applied (all adjustments are 0, no change)`)
          }
        } catch (adjError) {
          console.warn('⚠️ [Digital TV API] Error applying price adjustments:', adjError)
        }

        return createFreshResponse(transformedData)
      }
    }

    // Fallback to JSON file if Supabase is not configured or query fails
    console.log(`⚠️ [Digital TV API] Using JSON fallback (Supabase not configured or query failed)`)
    return createFreshResponse(digitalTvData)
  } catch (error) {
    console.error('❌ [Digital TV API] Error fetching digital TV:', error)
    console.log(`⚠️ [Digital TV API] Falling back to JSON file`)
    // Fallback to JSON file on error
    return createFreshResponse(digitalTvData)
  }
}

