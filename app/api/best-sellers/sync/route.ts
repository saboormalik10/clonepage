import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'
import { dataCache, CACHE_KEYS } from '@/lib/cache'

export const dynamic = 'force-dynamic'

interface BestSellerRecord {
  publication: string
  image: string
  genres: string
  price: string
  da: string
  dr: string
  tat: string
  region: string
  sponsored: string
  indexed: string
  dofollow: string
  example_url: string
  has_image: string
  niches: string
}

function removeBaseUrl(imageUrl: string): string {
  const baseUrl = 'https://pricing.ascendagency.com'
  if (imageUrl && imageUrl.startsWith(baseUrl)) {
    return imageUrl.replace(baseUrl, '')
  }
  return imageUrl
}

function parseCSVLine(line: string): BestSellerRecord | null {
  try {
    // The CSV contains JSON records, so parse the JSON
    const jsonStr = line.replace(/^"|"$/g, '').replace(/""/g, '"')
    const parsed = JSON.parse(jsonStr)
    return {
      publication: parsed.publication || '',
      image: removeBaseUrl(parsed.image || ''),
      genres: parsed.genres || '',
      price: parsed.price || '',
      da: parsed.da || '',
      dr: parsed.dr || '',
      tat: parsed.tat || '',
      region: parsed.region || '',
      sponsored: parsed.sponsored || '',
      indexed: parsed.indexed || '',
      dofollow: parsed.dofollow || '',
      example_url: parsed.example_url || '',
      has_image: parsed.has_image || '',
      niches: parsed.niches || ''
    }
  } catch (error) {
    console.error('Error parsing CSV line:', error)
    return null
  }
}

export async function POST(request: Request) {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  try {
    // Check if Supabase is configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ 
        success: false, 
        message: 'Supabase is not configured. Please check environment variables.',
        error: 'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY'
      }, { status: 500, headers })
    }

    // Get the uploaded CSV file from the request
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({ 
        success: false, 
        message: 'No file uploaded. Please upload a CSV file.' 
      }, { status: 400, headers })
    }

    // Check if file is CSV
    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ 
        success: false, 
        message: 'Invalid file type. Please upload a CSV file.' 
      }, { status: 400, headers })
    }

    // Read the CSV content
    const csvContent = await file.text()
    
    // Split by lines and skip the header
    const lines = csvContent.split('\n').filter(line => line.trim())
    const dataLines = lines.slice(1) // Skip "JSON Record" header
    
    // Parse all records from CSV
    const csvRecords: BestSellerRecord[] = []
    for (const line of dataLines) {
      const record = parseCSVLine(line)
      if (record && record.publication) {
        csvRecords.push(record)
      }
    }

    if (csvRecords.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'No valid records found in CSV file' 
      }, { status: 400, headers })
    }

    // Get all existing publications from the database
    let existingRecords: any[] = []
    try {
      const supabase = getSupabaseClient()
      const { data, error: fetchError } = await supabase
        .from('best_sellers')
        .select('publication')

      if (fetchError) {
        throw fetchError
      }
      existingRecords = data || []
    } catch (fetchError) {
      console.error('Error fetching existing records:', fetchError)
      return NextResponse.json({ 
        success: false, 
        message: 'Error fetching existing records from database',
        error: fetchError instanceof Error ? fetchError.message : 'Database connection failed'
      }, { status: 500, headers })
    }

    // Create a set of existing publication names for quick lookup
    const existingPublications = new Set(
      existingRecords.map(r => r.publication?.toLowerCase())
    )

    // Filter records that don't exist in the database
    const newRecords = csvRecords.filter(
      record => !existingPublications.has(record.publication?.toLowerCase())
    )

    if (newRecords.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'All records already exist in the database',
        inserted: 0,
        total: csvRecords.length,
        existing: existingRecords.length
      }, { headers })
    }

    // Insert new records
    try {
      const supabase = getSupabaseClient()
      const { data: insertedData, error: insertError } = await supabase
        .from('best_sellers')
        .insert(newRecords)
        .select()

      if (insertError) {
        throw insertError
      }

      // Invalidate cache after successful insert
      dataCache.invalidate(CACHE_KEYS.BEST_SELLERS)

      return NextResponse.json({ 
        success: true, 
        message: `Successfully inserted ${newRecords.length} new records`,
        inserted: newRecords.length,
        total: csvRecords.length,
        existing: existingRecords.length,
        newRecords: newRecords.map(r => r.publication)
      }, { headers })

    } catch (insertError) {
      console.error('Error inserting records:', insertError)
      return NextResponse.json({ 
        success: false, 
        message: 'Error inserting records into database',
        error: insertError instanceof Error ? insertError.message : 'Database insert failed'
      }, { status: 500, headers })
    }

  } catch (error) {
    console.error('Error in sync API:', error)
    return NextResponse.json({ 
      success: false, 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500, headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }})
  }
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  })
}

export async function GET(request: Request) {
  return NextResponse.json({ 
    message: 'Use POST method to sync best sellers data from CSV to database',
    endpoint: '/api/best-sellers/sync'
  }, { 
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  })
}
