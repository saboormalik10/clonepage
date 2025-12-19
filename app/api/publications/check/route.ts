import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'
import { createFreshResponse, routeConfig } from '@/lib/api-helpers'

// Disable Next.js caching for this route
export const dynamic = routeConfig.dynamic
export const revalidate = routeConfig.revalidate

/**
 * Publication data structure for checking
 */
interface PublicationCheckData {
  name: string
  price: string
  da: string
  dr: string
}

/**
 * POST /api/publications/check
 * 
 * Accepts a list of publications with name, url, price, DA, DR and checks if they exist in the database.
 * Returns an object mapping each publication name to true (exists) or false (doesn't exist).
 * 
 * Request body:
 * {
 *   "publications": [
 *     { "name": "Publication 1", "price": "1500", "da": "82", "dr": "75" },
 *     { "name": "Publication 2", "price": "2000", "da": "65", "dr": "60" },
 *     ...
 *   ]
 * }
 * 
 * Response:
 * {
 *   "Publication 1": true,
 *   "Publication 2": false,
 *   ...
 * }
 */
export async function POST(request: Request) {
  try {
    // Parse request body
    const body = await request.json()
    const { publications } = body

    // Validate input
    if (!publications || !Array.isArray(publications)) {
      return NextResponse.json(
        { error: 'Invalid request. Expected { publications: [{ name, url, price, da, dr }, ...] }' },
        { status: 400 }
      )
    }

    if (publications.length === 0) {
      return createFreshResponse({})
    }

    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ [Publications Check API] Missing Supabase environment variables')
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    console.log(`🔍 [Publications Check API] Checking ${publications.length} publications (using name + price + DA + DR)...`)
    
    const supabase = getSupabaseClient()

    // Extract names for the initial query
    const names = publications.map((pub: PublicationCheckData) => pub.name)

    // Query database for matching publication names
    // We fetch name, default_price, domain_authority, domain_rating for comparison
    const { data, error } = await supabase
      .from('publications')
      .select('name, default_price, domain_authority, domain_rating')
      .in('name', names)

    if (error) {
      console.error('❌ [Publications Check API] Supabase query error:', error)
      return NextResponse.json(
        { error: 'Database query failed', details: error.message },
        { status: 500 }
      )
    }

    // Create a Map for efficient lookup - key is combination of name + price + da + dr
    const existingPublications = new Map<string, boolean>()
    
    if (data) {
      for (const dbPub of data) {
        // Extract price from default_price (it's a JSONB array like [1500])
        const dbPrice = Array.isArray(dbPub.default_price) && dbPub.default_price.length > 0 
          ? String(dbPub.default_price[0]) 
          : ''
        const dbDa = dbPub.domain_authority !== null ? String(dbPub.domain_authority) : ''
        const dbDr = dbPub.domain_rating !== null ? String(dbPub.domain_rating) : ''
        
        // Create a composite key for the DB record
        const key = `${dbPub.name}|||${dbPrice}|||${dbDa}|||${dbDr}`
        existingPublications.set(key, true)
        
        // Also store just by name for logging
        existingPublications.set(`name:${dbPub.name}`, true)
      }
    }

    // Build the result object mapping each name to true/false
    const result: Record<string, boolean> = {}
    let matchedCount = 0
    
    for (const pub of publications as PublicationCheckData[]) {
      // Create composite key from incoming data
      const incomingKey = `${pub.name}|||${pub.price}|||${pub.da}|||${pub.dr}`
      
      // Check if this exact combination exists
      const exists = existingPublications.has(incomingKey)
      result[pub.name] = exists
      
      if (exists) {
        matchedCount++
      } else if (existingPublications.has(`name:${pub.name}`)) {
        // Name exists but with different values - log for debugging
        console.log(`⚠️ [Publications Check API] "${pub.name}" exists but with different values (price/DA/DR mismatch)`)
      }
    }

    const existingCount = matchedCount
    const missingCount = publications.length - existingCount
    
    console.log(`✅ [Publications Check API] Found ${existingCount} exact matches, ${missingCount} new/modified out of ${publications.length} publications`)

    return createFreshResponse(result)

  } catch (error: any) {
    console.error('❌ [Publications Check API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
