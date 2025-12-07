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
      // Add timeout to the query
      const queryPromise = fetchAllRecords(supabase, 'publications', {
        orderBy: 'name',
        ascending: true
      })
      
      // Set a 45 second timeout for the database query
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Database query timeout')), 45000)
      })
      
      data = await Promise.race([queryPromise, timeoutPromise])
    } catch (error: any) {
      console.error('❌ [Publications API] Supabase query error:', error)
      if (error.message === 'Database query timeout') {
        console.error('   Query timed out after 45 seconds')
      } else {
        console.error('   Error code:', error.code)
        console.error('   Error message:', error.message)
        console.error('   Error details:', error.details)
      }
      console.log(`⚠️ [Publications API] Using JSON fallback (Supabase query failed)`)
      return createFreshResponse(publicationsDataRaw)
    }

    if (data && data.length > 0) {
        // Transform data to match the expected format
        // Convert snake_case to camelCase - optimized for performance
        const transformedData = data.map((pub: any) => {
          // Use object spread for better performance
          const transformed: any = {
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
          }
          return transformed
        })

        // Apply price adjustments (global always, user-specific if userId provided)
        let adjustments: any = null
        let finalTransformedData = transformedData
        try {
          // Get adjustments with timeout
          const adjustmentsPromise = getPriceAdjustments(userId, 'publications')
          const adjustmentsTimeout = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Price adjustments timeout')), 10000)
          })
          adjustments = await Promise.race([adjustmentsPromise, adjustmentsTimeout])
          
          // Apply adjustments - run in a separate task to allow timeout
          // Since applyAdjustmentsToPublications is synchronous, we wrap it to make it interruptible
          const applyPromise = new Promise<any[]>((resolve) => {
            // Use setImmediate or setTimeout(0) to make it async
            setTimeout(() => {
              try {
                const result = applyAdjustmentsToPublications(transformedData, adjustments)
                resolve(result)
              } catch (error) {
                resolve(transformedData) // Return original data on error
              }
            }, 0)
          })
          
          const applyTimeout = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Apply adjustments timeout')), 20000)
          })
          
          finalTransformedData = await Promise.race([applyPromise, applyTimeout])
        } catch (adjError: any) {
          console.error('❌ [Publications API] Error applying price adjustments:', adjError?.message)
          // Continue without adjustments if there's an error or timeout
          finalTransformedData = transformedData
        }
        
        const result = {
          query: '',
          result: finalTransformedData,
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

