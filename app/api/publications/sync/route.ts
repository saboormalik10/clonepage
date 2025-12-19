import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'
import { dataCache, CACHE_KEYS } from '@/lib/cache'

export const dynamic = 'force-dynamic'

interface PublicationRecord {
  _id: string
  name: string
  domain_authority: number | null  // NUMERIC (supports decimals)
  domain_rating: number | null     // NUMERIC (supports decimals)
  estimated_time: string | null
  sponsored: string | null
  indexed: string | null
  do_follow: string | null
  image: string | null
  img_explain: string | null
  health: boolean
  health_multiplier: string | null   // TEXT field
  cbd: boolean
  cbd_multiplier: string | null      // TEXT field
  crypto: boolean
  crypto_multiplier: string | null   // TEXT field
  gambling: boolean
  gambling_multiplier: string | null // TEXT field
  erotic: boolean
  erotic_multiplier: string | null   // TEXT field
  erotic_price: string | null        // TEXT field
  default_price: number[] | null     // Array of numbers for JSONB
  custom_price: any | null
  genres: Array<{name: string}> | null
  regions: Array<{name: string}> | null
  logo: any | null
  article_preview: any | null
}

function removeBaseUrl(imageUrl: string): string {
  const baseUrl = 'https://pricing.ascendagency.com'
  if (imageUrl && imageUrl.startsWith(baseUrl)) {
    return imageUrl.replace(baseUrl, '')
  }
  return imageUrl
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

function parseCSVLine(line: string): PublicationRecord | null {
  try {
    // The CSV contains JSON records, so parse the JSON
    const jsonStr = line.replace(/^"|"$/g, '').replace(/""/g, '"')
    const parsed = JSON.parse(jsonStr)
    
    // Clean and validate the data
    const cleanedData = {
      _id: generateUUID(), // Generate new UUID instead of using CSV's _id
      name: (parsed.name || '').trim().substring(0, 255), // Limit name length
      domain_authority: (() => {
        const val = parsed.domain_authority
        if (typeof val === 'number') return val // Keep as decimal
        if (typeof val === 'string') {
          const parsed = parseFloat(val)
          return isNaN(parsed) ? null : parsed
        }
        return null
      })(),
      domain_rating: (() => {
        const val = parsed.domain_rating
        if (typeof val === 'number') return val // Keep as decimal
        if (typeof val === 'string') {
          const parsed = parseFloat(val)
          return isNaN(parsed) ? null : parsed
        }
        return null
      })(),
      estimated_time: parsed.estimated_time ? String(parsed.estimated_time).substring(0, 100) : null,
      sponsored: parsed.sponsored ? String(parsed.sponsored).substring(0, 50) : null,
      indexed: parsed.indexed ? String(parsed.indexed).substring(0, 50) : null,
      do_follow: parsed.do_follow ? String(parsed.do_follow).substring(0, 50) : null,
      image: removeBaseUrl(parsed.image || '').substring(0, 500),
      img_explain: parsed.img_explain ? String(parsed.img_explain).substring(0, 1000) : null,
      health: Boolean(parsed.health),
      health_multiplier: parsed.health_multiplier ? String(parsed.health_multiplier) : null,
      cbd: Boolean(parsed.cbd),
      cbd_multiplier: parsed.cbd_multiplier ? String(parsed.cbd_multiplier) : null,
      crypto: Boolean(parsed.crypto),
      crypto_multiplier: parsed.crypto_multiplier ? String(parsed.crypto_multiplier) : null,
      gambling: Boolean(parsed.gambling),
      gambling_multiplier: parsed.gambling_multiplier ? String(parsed.gambling_multiplier) : null,
      erotic: Boolean(parsed.erotic),
      erotic_multiplier: parsed.erotic_multiplier ? String(parsed.erotic_multiplier) : null,
      erotic_price: parsed.erotic_price ? String(parsed.erotic_price) : null,
      default_price: (() => {
        if (Array.isArray(parsed.default_price) && parsed.default_price.length > 0) {
          // Convert from [{min: 75, max: 75}] to [75] format
          return parsed.default_price.map((priceObj: any) => {
            if (typeof priceObj === 'object' && priceObj.min !== undefined) {
              // Use min value if it's a range object
              return typeof priceObj.min === 'number' ? priceObj.min : 0
            }
            // If it's already a number, keep it
            return typeof priceObj === 'number' ? priceObj : 0
          }).filter((price: number) => price > 0) // Remove invalid prices
        }
        return null
      })(),
      custom_price: parsed.custom_price || null,
      genres: Array.isArray(parsed.genres) ? parsed.genres : null,
      regions: Array.isArray(parsed.regions) ? parsed.regions : null,
      logo: parsed.logo || null,
      article_preview: parsed.article_preview || null
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
    const csvRecords: PublicationRecord[] = []
    for (const line of dataLines) {
      const record = parseCSVLine(line)
      if (record && record.name) {
        csvRecords.push(record)
      }
    }

    if (csvRecords.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'No valid records found in CSV file' 
      }, { status: 400, headers })
    }

    // Get all existing publications with name, price, domain_authority, domain_rating from the database
    let existingRecords: any[] = []
    try {
      const supabase = getSupabaseClient()
      const { data, error: fetchError } = await supabase
        .from('publications')
        .select('name, default_price, domain_authority, domain_rating')

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

    // Create a set of existing publication signatures for quick lookup
    const existingPublications = new Set(
      existingRecords.map(r => {
        const name = r.name?.toLowerCase() || ''
        const price = JSON.stringify(r.default_price || [])
        const da = r.domain_authority || 0
        const dr = r.domain_rating || 0
        return `${name}|${price}|${da}|${dr}`
      })
    )

    // Filter records that don't exist in the database (compare by name, price, DA, DR)
    const newRecords = csvRecords.filter(record => {
      const name = record.name?.toLowerCase() || ''
      const price = JSON.stringify(record.default_price || [])
      const da = record.domain_authority || 0
      const dr = record.domain_rating || 0
      const signature = `${name}|${price}|${da}|${dr}`
      return !existingPublications.has(signature)
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
        .from('publications')
        .insert(newRecords)
        .select()

      if (insertError) {
        throw insertError
      }

      // Invalidate cache after successful insert
      dataCache.invalidate(CACHE_KEYS.PUBLICATIONS)

      return NextResponse.json({ 
        success: true, 
        message: `Successfully inserted ${newRecords.length} new records`,
        inserted: newRecords.length,
        total: csvRecords.length,
        existing: existingRecords.length,
        newRecords: newRecords.map(r => r.name)
      }, { headers })

    } catch (insertError) {
      console.error('Error inserting records:', insertError)
      console.error('Full error details:', JSON.stringify(insertError, null, 2))
      console.error('Sample record being inserted:')
      if (newRecords.length > 0) {
        const sample = newRecords[0]
        console.error('  Name:', sample.name)
        console.error('  Domain Authority:', sample.domain_authority, typeof sample.domain_authority)
        console.error('  Domain Rating:', sample.domain_rating, typeof sample.domain_rating)
        console.error('  Health Multiplier:', sample.health_multiplier, typeof sample.health_multiplier)
        console.error('  Default Price:', sample.default_price)
      }
      
      return NextResponse.json({ 
        success: false, 
        message: 'Error inserting records into database. Please run the schema update SQL first.',
        error: insertError instanceof Error ? insertError.message : 'Database insert failed',
        details: insertError,
        sqlScript: `
-- Run this SQL in Supabase SQL Editor to fix the schema:
ALTER TABLE publications 
  ALTER COLUMN domain_authority TYPE NUMERIC USING domain_authority::NUMERIC,
  ALTER COLUMN domain_rating TYPE NUMERIC USING domain_rating::NUMERIC;
        `.trim()
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
    message: 'Use POST method to sync publications data from CSV to database',
    endpoint: '/api/publications/sync'
  }, { 
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  })
}