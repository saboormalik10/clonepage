import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import listiclesData from '@/data/listiclesData.json'
import { getPriceAdjustments, adjustListiclesPrice } from '@/lib/price-adjustments'
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
        data = await fetchAllRecords(supabase, 'listicles', {
          orderBy: 'publication',
          ascending: true
        })
      } catch (error) {
        console.error('❌ [Listicles API] Supabase query error:', error)
      }

      if (data && data.length > 0) {
        console.log(`✅ [Listicles API] Loaded ${data.length} listicles from Supabase`)
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
          console.log(`💰 [Listicles API] Price adjustments fetched:`, adjustments)
          // Always apply adjustments (even if 0) to ensure consistency
          transformedData = transformedData.map((item: any) => ({
            ...item,
            price: adjustListiclesPrice(item.price, adjustments)
          }))
          console.log(`✅ [Listicles API] Applied price adjustments to ${transformedData.length} items`)
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
    console.log(`⚠️ [Listicles API] Using JSON fallback (Supabase not configured or query failed)`)
    return NextResponse.json(listiclesData)
  } catch (error) {
    console.error('❌ [Listicles API] Error fetching listicles:', error)
    console.log(`⚠️ [Listicles API] Falling back to JSON file`)
    // Fallback to JSON file on error
    return NextResponse.json(listiclesData)
  }
}

