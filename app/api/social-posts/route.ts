import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getAdminClient } from '@/lib/admin-client'
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
        // Transform snake_case to camelCase and include id
        let transformedData = data.map((item: any) => ({
          id: item.id,
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

export async function POST(request: Request) {
  const authResult = await requireAuth(request)
  if (authResult instanceof Response) return authResult
  try {
    const body = await request.json()
    if (!body.publication) return NextResponse.json({ error: 'Publication is required' }, { status: 400 })
    const recordData = {
      publication: body.publication,
      image: body.image || null,
      url: body.url || null,
      platforms: body.platforms || [],
      price: body.price || null,
      tat: body.tat || null,
      example_url: body.exampleUrl || null
    }
    const { data, error } = await supabase.from('social_posts').insert([recordData]).select()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, data: data[0] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const authResult = await requireAuth(request)
  if (authResult instanceof Response) return authResult
  try {
    const body = await request.json()
    if (!body.id) return NextResponse.json({ error: 'Record ID is required' }, { status: 400 })
    if (!body.publication) return NextResponse.json({ error: 'Publication is required' }, { status: 400 })
    const recordData = {
      publication: body.publication,
      image: body.image || null,
      url: body.url || null,
      platforms: body.platforms || [],
      price: body.price || null,
      tat: body.tat || null,
      example_url: body.exampleUrl || null
    }
    const { data, error } = await supabase.from('social_posts').update(recordData).eq('id', body.id).select()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    return NextResponse.json({ success: true, data: data[0] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const authResult = await requireAuth(request)
  if (authResult instanceof Response) return authResult
  try {
    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'Record ID is required' }, { status: 400 })
    }

    console.log('🗑️ [Social Posts API] Deleting record with ID:', id)

    // Use admin client to bypass RLS policies for delete operation
    const adminClient = getAdminClient()

    // Delete the record - Supabase will return the deleted row(s) if successful
    const { data, error } = await adminClient
      .from('social_posts')
      .delete()
      .eq('id', id)
      .select()

    if (error) {
      console.error('❌ [Social Posts API] Error deleting record:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // If no data is returned, the record didn't exist
    if (!data || data.length === 0) {
      console.warn('⚠️ [Social Posts API] No record found with ID:', id)
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }

    console.log('✅ [Social Posts API] Record deleted successfully:', data[0])
    return NextResponse.json({ success: true, data: data[0] })
  } catch (error: any) {
    console.error('❌ [Social Posts API] Error in DELETE:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

