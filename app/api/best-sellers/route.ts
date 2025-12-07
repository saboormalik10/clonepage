import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import bestSellersData from '@/data/bestSellersData.json'
import { getPriceAdjustments, adjustDollarPrice } from '@/lib/price-adjustments'
import { requireAuth } from '@/lib/auth-middleware'
import { fetchAllRecords } from '@/lib/supabase-helpers'

export const dynamic = 'force-dynamic'

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
        data = await fetchAllRecords(supabase, 'best_sellers', {
          orderBy: 'publication',
          ascending: true
        })
      } catch (error) {
        console.error('❌ [Best Sellers API] Supabase query error:', error)
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
          transformedData = transformedData.map((item: any) => ({
            ...item,
            price: adjustDollarPrice(item.price, adjustments)
          }))
        } catch (adjError) {
          console.warn('⚠️ [Best Sellers API] Error applying price adjustments:', adjError)
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
    return NextResponse.json(bestSellersData)
  } catch (error) {
    console.error('❌ [Best Sellers API] Error fetching best sellers:', error)
    // Fallback to JSON file on error
    return NextResponse.json(bestSellersData)
  }
}

