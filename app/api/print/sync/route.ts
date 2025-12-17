import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/admin-client'

export const dynamic = 'force-dynamic'

interface Magazine {
  url: string
  name: string
  details: string[]
}

interface PrintRecord {
  category: string
  magazines: Magazine[]
}

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

export async function POST(request: Request) {
  console.log('🔄 [Print Sync] Starting sync process...')

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Read and parse CSV
    const csvContent = await file.text()
    const lines = csvContent.split('\n').filter(line => line.trim())
    
    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV file must have header and data rows' }, { status: 400 })
    }

    const header = lines[0].toLowerCase()
    if (!header.includes('json record') && !header.includes('magazines')) {
      return NextResponse.json({ error: 'CSV must have "JSON Record" or "magazines" header' }, { status: 400 })
    }

    console.log(`📊 [Print Sync] Processing ${lines.length - 1} records from CSV`)

    // Parse JSON records from CSV
    const records = []
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      try {
        // Handle both quoted and unquoted JSON
        let jsonStr = line
        if (line.startsWith('"') && line.endsWith('"')) {
          // Remove outer quotes and unescape inner quotes
          jsonStr = line.slice(1, -1).replace(/""/g, '"')
        }
        
        const record = JSON.parse(jsonStr)
        if (record.category && Array.isArray(record.magazines)) {
          records.push(record)
        } else {
          console.warn(`⚠️ [Print Sync] Skipping invalid record: ${line.substring(0, 100)}...`)
        }
      } catch (error) {
        console.error(`❌ [Print Sync] Error parsing line ${i}: ${error instanceof Error ? error.message : String(error)}`)
        console.error(`   Line content: ${line.substring(0, 200)}...`)
      }
    }

    if (records.length === 0) {
      return NextResponse.json({ error: 'No valid records found in CSV' }, { status: 400 })
    }

    console.log(`✅ [Print Sync] Parsed ${records.length} valid records`)

    // Get admin client to bypass RLS
    const supabase = getAdminClient()

    // Get existing records from database
    const { data: existingRecords, error: fetchError } = await supabase
      .from('print')
      .select('*')
    
    if (fetchError) {
      console.error('❌ [Print Sync] Error fetching existing records:', fetchError)
      return NextResponse.json({ error: `Database error: ${fetchError.message}` }, { status: 500 })
    }

    console.log(`📋 [Print Sync] Found ${existingRecords?.length || 0} existing records in database`)

    let newRecords = 0
    let updatedRecords = 0
    let skippedRecords = 0

    // Process each CSV record
    for (const csvRecord of records) {
      const { category, magazines } = csvRecord

      // Check if category already exists
      const existingRecord = existingRecords?.find(r => 
        r.category.toLowerCase() === category.toLowerCase()
      )

      if (existingRecord) {
        // Category exists - merge magazines by name
        console.log(`🔄 [Print Sync] Updating existing category: ${category}`)
        
        const existingMagazines = (existingRecord.magazines || []) as Magazine[]
        const newMagazines = [...existingMagazines]

        // Add new magazines or update existing ones
        for (const csvMagazine of magazines) {
          const existingIndex = existingMagazines.findIndex((m: Magazine) => 
            m.name.toLowerCase() === csvMagazine.name.toLowerCase()
          )

          if (existingIndex >= 0) {
            // Update existing magazine
            newMagazines[existingIndex] = csvMagazine
            console.log(`   📝 Updated magazine: ${csvMagazine.name}`)
          } else {
            // Add new magazine
            newMagazines.push(csvMagazine)
            console.log(`   ➕ Added new magazine: ${csvMagazine.name}`)
          }
        }

        // Update the record in database
        const { error: updateError } = await supabase
          .from('print')
          .update({ magazines: newMagazines })
          .eq('id', existingRecord.id)

        if (updateError) {
          console.error(`❌ [Print Sync] Error updating ${category}:`, updateError)
          skippedRecords++
        } else {
          console.log(`✅ [Print Sync] Updated ${category} with ${newMagazines.length} magazines`)
          updatedRecords++
        }

      } else {
        // Category doesn't exist - create new record
        console.log(`➕ [Print Sync] Creating new category: ${category}`)

        const { error: insertError } = await supabase
          .from('print')
          .insert({
            category,
            magazines
          })

        if (insertError) {
          console.error(`❌ [Print Sync] Error creating ${category}:`, insertError)
          skippedRecords++
        } else {
          console.log(`✅ [Print Sync] Created ${category} with ${magazines.length} magazines`)
          newRecords++
        }
      }
    }

    const result = {
      success: true,
      message: 'Print sync completed successfully',
      summary: {
        totalProcessed: records.length,
        newRecords,
        updatedRecords,
        skippedRecords
      }
    }

    console.log('🎉 [Print Sync] Sync completed:', result.summary)
    const response = NextResponse.json(result)
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    return response

  } catch (error) {
    console.error('❌ [Print Sync] Sync failed:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    }, { status: 500 })
  }
}