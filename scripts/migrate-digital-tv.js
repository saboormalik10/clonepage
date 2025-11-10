const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Supabase credentials not found!')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function migrateDigitalTv() {
  console.log('\n🚀 Starting Digital TV Migration...\n')
  console.log('='.repeat(60))

  // Read digital TV data
  const filePath = path.join(__dirname, '../data/digitalTvData.json')
  const fileContent = fs.readFileSync(filePath, 'utf8')
  const digitalTv = JSON.parse(fileContent)

  console.log(`📊 Found ${digitalTv.length} digital TV entries to migrate\n`)

  let successCount = 0
  let errorCount = 0
  const errors = []

  // Process in batches of 100
  const batchSize = 100
  const totalBatches = Math.ceil(digitalTv.length / batchSize)

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const start = batchIndex * batchSize
    const end = Math.min(start + batchSize, digitalTv.length)
    const batch = digitalTv.slice(start, end)

    console.log(`📦 Processing batch ${batchIndex + 1}/${totalBatches} (${start + 1}-${end})...`)

    const transformedBatch = batch.map(item => ({
      call_sign: item.callSign || null,
      station: item.station || '',
      rate: item.rate || null,
      tat: item.tat || null,
      sponsored: item.sponsored || null,
      indexed: item.indexed || null,
      segment_length: item.segmentLength || null,
      location: item.location || null,
      program_name: item.programName || null,
      interview_type: item.interviewType || null,
      example_url: item.exampleUrl || null
    }))

    // Insert batch
    const { data: insertedData, error } = await supabase
      .from('digital_tv')
      .upsert(transformedBatch)

    if (error) {
      console.error(`❌ Batch ${batchIndex + 1} failed:`, error.message)
      
      // If batch fails, try one by one
      console.log(`   Trying individual inserts for this batch...`)
      for (const item of batch) {
        try {
          const transformed = {
            call_sign: item.callSign || null,
            station: item.station || '',
            rate: item.rate || null,
            tat: item.tat || null,
            sponsored: item.sponsored || null,
            indexed: item.indexed || null,
            segment_length: item.segmentLength || null,
            location: item.location || null,
            program_name: item.programName || null,
            interview_type: item.interviewType || null,
            example_url: item.exampleUrl || null
          }

          const { error: singleError } = await supabase
            .from('digital_tv')
            .upsert(transformed)

          if (singleError) {
            console.error(`   ❌ Failed: ${item.station} - ${singleError.message}`)
            errorCount++
            errors.push({ station: item.station, error: singleError.message })
          } else {
            successCount++
          }
        } catch (err) {
          console.error(`   ❌ Error processing ${item.station}:`, err.message)
          errorCount++
          errors.push({ station: item.station, error: err.message })
        }
      }
    } else {
      successCount += batch.length
      console.log(`   ✅ Batch ${batchIndex + 1} completed: ${batch.length} digital TV entries`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('\n📊 Migration Summary:')
  console.log(`   ✅ Success: ${successCount} digital TV entries`)
  console.log(`   ❌ Failed: ${errorCount} digital TV entries`)

  if (errors.length > 0) {
    console.log('\n⚠️  Errors encountered:')
    errors.slice(0, 10).forEach(err => {
      console.log(`   - ${err.station}: ${err.error}`)
    })
    if (errors.length > 10) {
      console.log(`   ... and ${errors.length - 10} more errors`)
    }
  }

  console.log('\n✅ Digital TV migration completed!\n')
}

migrateDigitalTv().catch(console.error)

