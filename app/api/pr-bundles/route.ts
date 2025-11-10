import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import prBundlesData from '@/data/prBundlesData.json'
import { getPriceAdjustments, adjustPRBundles } from '@/lib/price-adjustments'
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
        data = await fetchAllRecords(supabase, 'pr_bundles', {
          orderBy: 'category',
          ascending: true
        })
      } catch (error) {
        console.error('❌ [PR Bundles API] Supabase query error:', error)
      }

      if (data && data.length > 0) {
        console.log(`✅ [PR Bundles API] Loaded ${data.length} PR bundle categories from Supabase`)
        // Transform to match expected format
        let transformedData = data.map((item: any) => ({
          category: item.category,
          bundles: item.bundles || []
        }))

        // Apply price adjustments
        try {
          const adjustments = await getPriceAdjustments(userId, 'pr_bundles')
          console.log(`💰 [PR Bundles API] Price adjustments fetched: Global ${adjustments.global}%, User ${adjustments.user}%, Total ${adjustments.total}%`)
          // Always apply adjustments (even if 0) to ensure consistency
          transformedData = transformedData.map((item: any) => ({
            ...item,
            bundles: adjustPRBundles(item.bundles, adjustments)
          }))
          if (adjustments.total !== 0) {
            console.log(`✅ [PR Bundles API] Applied price adjustments to ${transformedData.length} categories`)
          } else {
            console.log(`ℹ️ [PR Bundles API] Price adjustments applied (all adjustments are 0, no change)`)
          }
        } catch (adjError) {
          console.warn('⚠️ [PR Bundles API] Error applying price adjustments:', adjError)
        }

        return NextResponse.json(transformedData)
      }
    }

    // Fallback to JSON file if Supabase is not configured or query failed
    console.log(`⚠️ [PR Bundles API] Using JSON fallback (Supabase not configured or query failed)`)
    return NextResponse.json(prBundlesData)
  } catch (error) {
    console.error('❌ [PR Bundles API] Error fetching PR bundles:', error)
    console.log(`⚠️ [PR Bundles API] Falling back to JSON file`)
    // Fallback to JSON file on error
    return NextResponse.json(prBundlesData)
  }
}

