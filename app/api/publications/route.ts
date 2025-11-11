import { getSupabaseClient } from '@/lib/supabase'
import publicationsDataRaw from '@/data/publicationsData.json'
import { createFreshResponse, routeConfig } from '@/lib/api-helpers'
import { getPriceAdjustments, applyAdjustmentsToPublications } from '@/lib/price-adjustments'
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
    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ [Publications API] Missing Supabase environment variables:')
      console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing')
      console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseKey ? '✅ Set' : '❌ Missing')
      console.log(`⚠️ [Publications API] Using JSON fallback (Supabase not configured)`)
      return createFreshResponse(publicationsDataRaw)
    }

    // Try to fetch from Supabase first
    console.log('🔍 [Publications API] Attempting to fetch from Supabase...')
    const supabase = getSupabaseClient()
    
    let data: any[] = []
    try {
      data = await fetchAllRecords(supabase, 'publications', {
        orderBy: 'name',
        ascending: true
      })
    } catch (error: any) {
      console.error('❌ [Publications API] Supabase query error:', error)
      console.error('   Error code:', error.code)
      console.error('   Error message:', error.message)
      console.error('   Error details:', error.details)
      console.log(`⚠️ [Publications API] Using JSON fallback (Supabase query failed)`)
      return createFreshResponse(publicationsDataRaw)
    }

    if (data && data.length > 0) {
      console.log('🔍 [Publications API] Data:', data)
        console.log(`✅ [Publications API] Loaded ${data.length} publications from Supabase`)
        // Transform data to match the expected format
        // Convert snake_case to camelCase
        let transformedData = data.map((pub: any) => ({
          _id: pub._id,
          name: pub.name,
          logo: pub.logo,
          genres: pub.genres,
          defaultPrice: pub.default_price || [],
          customPrice: pub.custom_price || [],
          domain_authority: pub.domain_authority,
          domain_rating: pub.domain_rating,
          estimated_time: pub.estimated_time,
          regions: pub.regions || [],
          sponsored: pub.sponsored,
          indexed: pub.indexed,
          do_follow: pub.do_follow,
          articlePreview: pub.article_preview,
          image: pub.image,
          img_explain: pub.img_explain,
          url: pub.url,
          health: pub.health,
          healthMultiplier: pub.health_multiplier,
          cbd: pub.cbd,
          cbdMultiplier: pub.cbd_multiplier,
          crypto: pub.crypto,
          cryptoMultiplier: pub.crypto_multiplier,
          gambling: pub.gambling,
          gamblingMultiplier: pub.gambling_multiplier,
          erotic: pub.erotic,
          eroticMultiplier: pub.erotic_multiplier,
          eroticPrice: pub.erotic_price,
          badges: pub.badges || [],
          business: pub.business,
          isPresale: pub.is_presale,
          listicles: pub.listicles,
          moreInfo: pub.more_info,
          saleExpireDate: pub.sale_expire_date,
          salePrice: pub.sale_price,
          showOnSale: pub.show_on_sale,
          slug: pub.slug
        }))

        // Apply price adjustments (global always, user-specific if userId provided)
        let adjustments: any = null
        try {
          console.log(`🔍 [Publications API] Fetching price adjustments for userId: ${userId || 'none'}`)
          adjustments = await getPriceAdjustments(userId, 'publications')
          console.log(`💰 [Publications API] Price adjustments fetched:`, adjustments)
          // Always apply adjustments (even if 0) to ensure consistency
          transformedData = applyAdjustmentsToPublications(transformedData, adjustments)
          console.log(`✅ [Publications API] Applied price adjustments to ${transformedData.length} publications`)
        } catch (adjError: any) {
          console.error('❌ [Publications API] Error applying price adjustments:', adjError)
          console.error('   Error message:', adjError?.message)
          console.error('   Error details:', adjError?.details)
          // Continue without adjustments if there's an error
        }
        
        const result = {
          query: '',
          result: transformedData,
          syncTags: [],
          ms: 0,
          priceAdjustments: adjustments // Include adjustment details for frontend
        }
        return createFreshResponse(result)
    } else {
      console.warn('⚠️ [Publications API] Supabase returned empty data array')
      console.log(`⚠️ [Publications API] Using JSON fallback (no data in Supabase)`)
      return createFreshResponse(publicationsDataRaw)
    }
  } catch (error) {
    console.error('❌ [Publications API] Error fetching publications:', error)
    console.log(`⚠️ [Publications API] Falling back to JSON file`)
    // Fallback to JSON file on error
    return createFreshResponse(publicationsDataRaw)
  }
}

