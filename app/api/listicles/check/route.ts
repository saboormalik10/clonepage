import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'
import { createFreshResponse, routeConfig } from '@/lib/api-helpers'

// Disable Next.js caching for this route
export const dynamic = routeConfig.dynamic
export const revalidate = routeConfig.revalidate

/**
 * POST /api/listicles/check
 * 
 * Accepts a list of publication names and checks if they exist in the listicles table.
 * Returns an object mapping each publication name to true (exists) or false (doesn't exist).
 * 
 * Request body:
 * {
 *   "names": ["Publication 1", "Publication 2", ...]
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
    const { names } = body

    // Validate input
    if (!names || !Array.isArray(names)) {
      return NextResponse.json(
        { error: 'Invalid request. Expected { names: string[] }' },
        { status: 400 }
      )
    }

    if (names.length === 0) {
      return createFreshResponse({})
    }

    // Check environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ [Listicles Check API] Missing Supabase environment variables')
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      )
    }

    console.log(`🔍 [Listicles Check API] Checking ${names.length} publication names...`)
    
    const supabase = getSupabaseClient()

    // Query database for matching publication names in listicles table
    // Using 'in' filter to check all names in one query
    const { data, error } = await supabase
      .from('listicles')
      .select('publication')
      .in('publication', names)

    if (error) {
      console.error('❌ [Listicles Check API] Supabase query error:', error)
      return NextResponse.json(
        { error: 'Database query failed', details: error.message },
        { status: 500 }
      )
    }

    // Create a Set of existing names for O(1) lookup
    const existingNames = new Set(data?.map((item: { publication: string }) => item.publication) || [])

    // Build the result object mapping each name to true/false
    const result: Record<string, boolean> = {}
    for (const name of names) {
      result[name] = existingNames.has(name)
    }

    const existingCount = Object.values(result).filter(Boolean).length
    const missingCount = names.length - existingCount
    
    console.log(`✅ [Listicles Check API] Found ${existingCount} existing, ${missingCount} missing out of ${names.length} names`)

    return createFreshResponse(result)

  } catch (error: any) {
    console.error('❌ [Listicles Check API] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
