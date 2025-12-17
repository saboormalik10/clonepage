import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'
import { dataCache, CACHE_KEYS } from '@/lib/cache'

export const dynamic = 'force-dynamic'

interface BroadcastTvRecord {
  affiliate: string
  calls: string
  state: string
  market: string
  program: string
  location: string
  time: string
  rate: string
  example_url: string
  intake_url: string
}

function parseCSVLine(line: string): BroadcastTvRecord | null {
  try {
    // The CSV contains JSON records, so parse the JSON
    const jsonStr = line.replace(/^"|"$/g, '').replace(/""/g, '"')
    const parsed = JSON.parse(jsonStr)
    
    // Clean and validate the data according to broadcast_tv schema
    const cleanedData: BroadcastTvRecord = {
      affiliate: (parsed.affiliate || '').trim().substring(0, 100),
      calls: (parsed.calls || '').trim().substring(0, 100),
      state: (parsed.state || '').trim().substring(0, 100),
      market: (parsed.market || '').trim().substring(0, 200),
      program: (parsed.program || '').trim().substring(0, 200),
      location: (parsed.location || '').trim().substring(0, 200),
      time: (parsed.time || '').trim().substring(0, 100),
      rate: (parsed.rate || '').trim().substring(0, 50),
      example_url: parsed.exampleUrl ? String(parsed.exampleUrl).substring(0, 500) : '',
      intake_url: parsed.intakeUrl ? String(parsed.intakeUrl).substring(0, 500) : ''
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
    const csvRecords: BroadcastTvRecord[] = []
    for (const line of dataLines) {
      const record = parseCSVLine(line)
      if (record && record.calls && record.affiliate) {
        csvRecords.push(record)
      }
    }

    if (csvRecords.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'No valid records found in CSV file' 
      }, { status: 400, headers })
    }

    // Get all existing records from the database (using calls + affiliate as unique identifier)
    let existingRecords: any[] = []
    try {
      const supabase = getSupabaseClient()
      const { data, error: fetchError } = await supabase
        .from('broadcast_tv')
        .select('calls, affiliate')

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

    // Create a set of existing call signs + affiliate combinations for quick lookup
    const existingCombinations = new Set(
      existingRecords.map(r => `${r.calls?.toLowerCase()}-${r.affiliate?.toLowerCase()}`)
    )

    // Filter records that don't exist in the database (compare by calls + affiliate)
    const newRecords = csvRecords.filter(record => {
      const combination = `${record.calls?.toLowerCase()}-${record.affiliate?.toLowerCase()}`
      return !existingCombinations.has(combination)
    })

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
        .from('broadcast_tv')
        .insert(newRecords)
        .select()

      if (insertError) {
        throw insertError
      }

      // Invalidate cache after successful insert
      dataCache.invalidate(CACHE_KEYS.BROADCAST_TV)

      return NextResponse.json({ 
        success: true, 
        message: `Successfully inserted ${newRecords.length} new records`,
        inserted: newRecords.length,
        total: csvRecords.length,
        existing: existingRecords.length,
        newRecords: newRecords.map(r => `${r.calls} (${r.affiliate})`)
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
    message: 'Use POST method to sync broadcast TV data from CSV to database',
    endpoint: '/api/broadcast-tv/sync'
  }, { 
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  })
}