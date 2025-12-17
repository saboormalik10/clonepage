import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'
import { dataCache, CACHE_KEYS } from '@/lib/cache'

export const dynamic = 'force-dynamic'

interface ListicleRecord {
  publication: string
  image: string | null
  genres: string | null
  price: string | null
  da: string | null
  dr: string | null
  tat: string | null
  region: string | null
  sponsored: string | null
  indexed: string | null
  dofollow: string | null
  example_url: string | null
}

function parseCSVLine(line: string): ListicleRecord | null {
  try {
    // The CSV contains JSON records, so parse the JSON
    const jsonStr = line.replace(/^"|"$/g, '').replace(/""/g, '"')
    const parsed = JSON.parse(jsonStr)
    
    // Clean and validate the data according to listicles schema
    const cleanedData: ListicleRecord = {
      publication: (parsed.publication || '').trim().substring(0, 255),
      image: parsed.image ? (typeof parsed.image === 'string' ? parsed.image : JSON.stringify(parsed.image)) : null,
      genres: parsed.genres ? String(parsed.genres).substring(0, 500) : null,
      price: parsed.price ? String(parsed.price).substring(0, 255) : null,
      da: parsed.da ? String(parsed.da).substring(0, 10) : null,
      dr: parsed.dr ? String(parsed.dr).substring(0, 10) : null,
      tat: parsed.tat ? String(parsed.tat).substring(0, 100) : null,
      region: parsed.region ? String(parsed.region).substring(0, 255) : null,
      sponsored: parsed.sponsored ? String(parsed.sponsored).substring(0, 50) : null,
      indexed: parsed.indexed ? String(parsed.indexed).substring(0, 50) : null,
      dofollow: parsed.dofollow ? String(parsed.dofollow).substring(0, 50) : null,
      example_url: parsed.example_url ? String(parsed.example_url).substring(0, 500) : null
    }
    
    return cleanedData
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
    const csvRecords: ListicleRecord[] = []
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

    // Get all existing publication names from the database
    let existingRecords: any[] = []
    try {
      const supabase = getSupabaseClient()
      const { data, error: fetchError } = await supabase
        .from('listicles')
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

    // Filter records that don't exist in the database (compare by publication name)
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
        .from('listicles')
        .insert(newRecords)
        .select()

      if (insertError) {
        throw insertError
      }

      // Invalidate cache after successful insert
      dataCache.invalidate(CACHE_KEYS.LISTICLES)

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
      console.error('Full error details:', JSON.stringify(insertError, null, 2))
      console.error('Records being inserted:', JSON.stringify(newRecords.slice(0, 2), null, 2)) // Log first 2 records for debugging
      return NextResponse.json({ 
        success: false, 
        message: 'Error inserting records into database',
        error: insertError instanceof Error ? insertError.message : 'Database insert failed',
        details: insertError // Include full error details in response
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
    message: 'Use POST method to sync listicles data from CSV to database',
    endpoint: '/api/listicles/sync'
  }, { 
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  })
}