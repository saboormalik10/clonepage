import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'
import listiclesData from '@/data/listiclesData.json'
import { getPriceAdjustments, adjustListiclesPrice } from '@/lib/price-adjustments'
import { requireAuth } from '@/lib/auth-middleware'
import { fetchAllRecords } from '@/lib/supabase-helpers'
import { dataCache, CACHE_KEYS } from '@/lib/cache'

export const dynamic = 'force-dynamic'
export const revalidate = 0

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
      const cachedData = dataCache.get<any[]>(CACHE_KEYS.LISTICLES)
      if (cachedData) {
        data = cachedData
        console.log(`✅ [Listicles API] Using cached data: ${data.length} records`)
      } else {
        try {
          // Create fresh Supabase client for each request
          const supabase = getSupabaseClient()
          data = await fetchAllRecords(supabase, 'listicles', {
            orderBy: 'publication',
            ascending: true
          })
          // Cache the data
          dataCache.set(CACHE_KEYS.LISTICLES, data)
          console.log(`✅ [Listicles API] Fetched ${data.length} records from Supabase and cached`)
        } catch (error) {
          console.error('❌ [Listicles API] Supabase query error:', error)
        }
      }

      if (data && data.length > 0) {
        // Transform snake_case to camelCase
        let transformedData = data.map((item: any) => ({
          id: item.id, // Include id for delete functionality
          publication: item.publication,
          image: item.image,
          genres: item.genres,
          price: item.price,
          da: item.da,
          dr: item.dr,
          tat: item.tat,
          region: item.region,
          sponsored: item.sponsored,
          indexed: item.indexed,
          dofollow: item.dofollow,
          exampleUrl: item.example_url,
          hasImage: item.has_image
        }))

        // Apply price adjustments
        let adjustments: any = null
        try {
          adjustments = await getPriceAdjustments(userId, 'listicles')
          // Always apply adjustments (even if 0) to ensure consistency
          transformedData = transformedData.map((item: any) => ({
            ...item,
            price: adjustListiclesPrice(item.price, adjustments)
          }))
        } catch (adjError) {
          console.warn('⚠️ [Listicles API] Error applying price adjustments:', adjError)
        }

        // Include adjustments in response
        const result = {
          data: transformedData,
          priceAdjustments: adjustments
        }
        return NextResponse.json(result)
      }
    }

    // Fallback to JSON file if Supabase is not configured or query fails
    return NextResponse.json(listiclesData)
  } catch (error) {
    console.error('❌ [Listicles API] Error fetching listicles:', error)
    // Fallback to JSON file on error
    return NextResponse.json(listiclesData)
  }
}

