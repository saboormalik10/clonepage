import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/admin-client'
import printData from '@/data/printData.json'
import { getPriceAdjustments, adjustPrintMagazines } from '@/lib/price-adjustments'
import { requireAuth } from '@/lib/auth-middleware'
import { fetchAllRecords } from '@/lib/supabase-helpers'

export const dynamic = 'force-dynamic'

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

export async function GET(request: Request) {
  // Require authentication
  const authResult = await requireAuth(request)
  if (authResult instanceof Response) {
    return authResult // Return 401 if not authenticated
  }
  
  const userId = authResult.userId // Get userId from authenticated user
  
  console.log('🔍 [Print API] GET request - always fetching from database')
  
  try {
    // Fetch from Supabase using admin client to bypass RLS
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      let data: any[] = []
      
      try {
        const supabase = getAdminClient()
        console.log('🔍 [Print API] Fetching data from Supabase (using admin client)...')
        
        // Use direct query instead of fetchAllRecords helper
        const { data: rawData, error: rawError } = await supabase
          .from('print')
          .select('*')
          .order('category', { ascending: true })
        
        if (rawError) {
          console.error('❌ [Print API] Database query error:', rawError)
        } else {
          data = rawData || []
          console.log(`✅ [Print API] Fetched ${data.length} records from Supabase`)
          data.forEach(item => {
            console.log(`📄 Record ${item.id}: ${item.category} - ${item.magazines?.length || 0} magazines`)
          })
        }
      } catch (error) {
        console.error('❌ [Print API] Supabase query error:', error)
      }

      if (data && data.length > 0) {
        // Transform to match expected format and include id
        let transformedData = data.map((item: any) => ({
          id: item.id,
          category: item.category,
          magazines: item.magazines || []
        }))
        
        // Filter out records with empty magazines arrays (deleted content)
        transformedData = transformedData.filter((item: any) => 
          item.magazines && Array.isArray(item.magazines) && item.magazines.length > 0
        )
        
        console.log(`🔍 [Print API] After filtering empty records: ${transformedData.length} records remain`)

        // Apply price adjustments
        let adjustments: any = null
        try {
          adjustments = await getPriceAdjustments(userId, 'print')
          // Always apply adjustments (even if 0) to ensure consistency
          transformedData = transformedData.map((item: any) => ({
            ...item,
            magazines: adjustPrintMagazines(item.magazines, adjustments)
          }))
        } catch (adjError) {
          console.warn('⚠️ [Print API] Error applying price adjustments:', adjError)
        }

        // Include adjustments in response
        const result = {
          data: transformedData,
          priceAdjustments: adjustments
        }
        console.log('✅ [Print API] Returning database data, NOT fallback JSON')
        const response = NextResponse.json(result)
        response.headers.set('Access-Control-Allow-Origin', '*')
        response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        return response
      } else {
        console.log('⚠️ [Print API] No data from database, using JSON fallback')
      }
    } else {
      console.log('⚠️ [Print API] Supabase not configured, using JSON fallback')
    }

    // Fallback to JSON file if Supabase is not configured or query failed
    console.log('📄 [Print API] Using JSON fallback file')
    const response = NextResponse.json(printData)
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    return response
  } catch (error) {
    console.error('❌ [Print API] Error fetching print data:', error)
    // Fallback to JSON file on error
    const response = NextResponse.json(printData)
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    return response
  }
}

export async function PUT(request: Request) {
  // Require authentication
  const authResult = await requireAuth(request)
  if (authResult instanceof Response) {
    console.error('❌ [Print API] Authentication failed')
    return authResult // Return 401 if not authenticated
  }
  
  console.log('✅ [Print API] Authentication successful, userId:', authResult.userId)

  try {
    const body = await request.json()
    console.log('📝 [Print API] Updating record:', JSON.stringify(body, null, 2))
    console.log('📝 [Print API] Record ID:', body.id, 'Type:', typeof body.id)

    if (!body.id) {
      console.error('❌ [Print API] No record ID provided')
      return NextResponse.json({ error: 'Record ID is required' }, { status: 400 })
    }

    // Validate required fields
    if (!body.category) {
      console.error('❌ [Print API] No category provided')
      return NextResponse.json({ error: 'Category is required' }, { status: 400 })
    }

    // Transform data for database - ensure magazines is properly formatted for JSONB
    const recordData = {
      category: body.category,
      magazines: JSON.parse(JSON.stringify(body.magazines || []))
    }
    console.log('📝 [Print API] Record data to update:', JSON.stringify(recordData, null, 2))

    // Use admin client (service role) to bypass RLS for updates
    const supabase = getAdminClient()
    console.log('🔗 [Print API] Admin client created (using service role to bypass RLS)')
    
    // First, check if record exists
    console.log('🔍 [Print API] Checking if record exists with ID:', body.id)
    const { data: existingRecord, error: checkError } = await supabase
      .from('print')
      .select('id, category')
      .eq('id', body.id)
      .single()
    
    if (checkError) {
      console.error('❌ [Print API] Error checking existing record:', checkError)
      return NextResponse.json({ error: `Database check error: ${checkError.message}` }, { status: 500 })
    }
    
    if (!existingRecord) {
      console.error('❌ [Print API] Record not found with ID:', body.id)
      return NextResponse.json({ error: 'Record not found' }, { status: 404 })
    }
    
    console.log('✅ [Print API] Existing record found:', existingRecord)

    // Now update the record
    console.log('📝 [Print API] Performing update...')
    const { data, error } = await supabase
      .from('print')
      .update(recordData)
      .eq('id', body.id)
      .select()

    if (error) {
      console.error('❌ [Print API] Error updating record:', error)
      console.error('❌ [Print API] Error details:', JSON.stringify(error, null, 2))
      return NextResponse.json({ error: `Update error: ${error.message}` }, { status: 500 })
    }

    if (!data || data.length === 0) {
      console.error('❌ [Print API] No data returned from update')
      return NextResponse.json({ error: 'Update failed - no data returned' }, { status: 500 })
    }

    console.log('✅ [Print API] Record updated successfully:', data[0])
    
    const response = NextResponse.json({ 
      success: true, 
      data: data[0],
      message: 'Record updated successfully'
    })
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    return response
  } catch (error: any) {
    console.error('❌ [Print API] Error in PUT:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

