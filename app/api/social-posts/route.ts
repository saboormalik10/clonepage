import { supabase } from '@/lib/supabase'
import socialPostData from '@/data/socialPostData.json'
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
        data = await fetchAllRecords(supabase, 'social_posts', {
          orderBy: 'publication',
          ascending: true
        })
      } catch (error) {
        console.error('❌ [Social Posts API] Supabase query error:', error)
      }

      if (data && data.length > 0) {
        console.log(`✅ [Social Posts API] Loaded ${data.length} social posts from Supabase`)
        // Transform snake_case to camelCase
        let transformedData = data.map((item: any) => ({
          publication: item.publication,
          image: item.image,
          url: item.url,
          platforms: item.platforms || [],
          price: item.price,
          tat: item.tat,
          exampleUrl: item.example_url
        }))

        // Apply price adjustments
        let adjustments: any = null
        try {
          adjustments = await getPriceAdjustments(userId, 'social_posts')
          console.log(`💰 [Social Posts API] Price adjustments fetched:`, adjustments)
          // Always apply adjustments (even if 0) to ensure consistency
          transformedData = transformedData.map((item: any) => ({
            ...item,
            price: adjustDollarPrice(item.price, adjustments)
          }))
          console.log(`✅ [Social Posts API] Applied price adjustments to ${transformedData.length} items`)
        } catch (adjError) {
          console.warn('⚠️ [Social Posts API] Error applying price adjustments:', adjError)
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
    console.log(`⚠️ [Social Posts API] Using JSON fallback (Supabase not configured or query failed)`)
    return createFreshResponse(socialPostData)
  } catch (error) {
    console.error('❌ [Social Posts API] Error fetching social posts:', error)
    console.log(`⚠️ [Social Posts API] Falling back to JSON file`)
    // Fallback to JSON file on error
    return createFreshResponse(socialPostData)
  }
}

