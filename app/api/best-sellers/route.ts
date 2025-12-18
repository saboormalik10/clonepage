import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'
import bestSellersData from '@/data/bestSellersData.json'
import { getPriceAdjustments, adjustDollarPrice, adjustNichesPriceBasedOnMainPrice } from '@/lib/price-adjustments'
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
      const cachedData = dataCache.get<any[]>(CACHE_KEYS.BEST_SELLERS)
      if (cachedData) {
        data = cachedData
        console.log(`✅ [Best Sellers API] Using cached data: ${data.length} records`)
      } else {
        try {
          // Create fresh Supabase client for each request
          const supabase = getSupabaseClient()
          data = await fetchAllRecords(supabase, 'best_sellers', {
            orderBy: 'publication',
            ascending: true
          })
          // Cache the data
          dataCache.set(CACHE_KEYS.BEST_SELLERS, data)
          console.log(`✅ [Best Sellers API] Fetched ${data.length} records from Supabase best_sellers table and cached`)
        } catch (error) {
          console.error('❌ [Best Sellers API] Supabase query error:', error)
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
          hasImage: item.has_image,
          niches: item.niches
        }))

        // Apply price adjustments
        let adjustments: any = null
        try {
          adjustments = await getPriceAdjustments(userId, 'best_sellers')
          // Always apply adjustments (even if 0) to ensure consistency
          // For niches, use the main price to determine if adjustment applies, then apply same adjustment to all niche prices
          transformedData = transformedData.map((item: any) => ({
            ...item,
            price: adjustDollarPrice(item.price, adjustments),
            niches: adjustNichesPriceBasedOnMainPrice(item.niches, item.price, adjustments)
          }))
        } catch (adjError) {
          console.warn('⚠️ [Best Sellers API] Error applying price adjustments:', adjError)
        }

        // Include adjustments in response
        const result = {
          data: transformedData,
          priceAdjustments: adjustments,
          source: 'supabase',
          count: transformedData.length
        }
        return NextResponse.json(result, {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          }
        })
      }
    }

    // Fallback to JSON file if Supabase is not configured or query fails
    console.log(`⚠️ [Best Sellers API] Falling back to JSON file with ${(bestSellersData as any[]).length} records`)
    return NextResponse.json(bestSellersData, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    })
  } catch (error) {
    console.error('❌ [Best Sellers API] Error fetching best sellers:', error)
    // Fallback to JSON file on error
    console.log(`⚠️ [Best Sellers API] Error occurred, falling back to JSON file`)
    return NextResponse.json(bestSellersData, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    })
  }
}

