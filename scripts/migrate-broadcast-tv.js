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

async function migrateBroadcastTv() {
  console.log('\n🚀 Starting Broadcast TV Migration...\n')
  console.log('='.repeat(60))

  // Read broadcast TV data
  const filePath = path.join(__dirname, '../data/tableData.json')
  const fileContent = fs.readFileSync(filePath, 'utf8')
  const broadcastTv = JSON.parse(fileContent)

  console.log(`📊 Found ${broadcastTv.length} broadcast TV entries to migrate\n`)

  let successCount = 0
  let errorCount = 0
  const errors = []

  // Process in batches of 100
  const batchSize = 100
  const totalBatches = Math.ceil(broadcastTv.length / batchSize)

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const start = batchIndex * batchSize
    const end = Math.min(start + batchSize, broadcastTv.length)
    const batch = broadcastTv.slice(start, end)

    console.log(`📦 Processing batch ${batchIndex + 1}/${totalBatches} (${start + 1}-${end})...`)

    const transformedBatch = batch.map(item => ({
      affiliate: item.affiliate || null,
      calls: item.calls || null,
      state: item.state || null,
      market: item.market || null,
      program: item.program || null,
      location: item.location || null,
      time: item.time || null,
      rate: item.rate || null,
      example_url: item.exampleUrl || null,
      intake_url: item.intakeUrl || null
    }))

    // Insert batch
    const { data: insertedData, error } = await supabase
      .from('broadcast_tv')
      .upsert(transformedBatch)

    if (error) {
      console.error(`❌ Batch ${batchIndex + 1} failed:`, error.message)
      
      // If batch fails, try one by one
      console.log(`   Trying individual inserts for this batch...`)
      for (const item of batch) {
        try {
          const transformed = {
            affiliate: item.affiliate || null,
            calls: item.calls || null,
            state: item.state || null,
            market: item.market || null,
            program: item.program || null,
            location: item.location || null,
            time: item.time || null,
            rate: item.rate || null,
            example_url: item.exampleUrl || null,
            intake_url: item.intakeUrl || null
          }

          const { error: singleError } = await supabase
            .from('broadcast_tv')
            .upsert(transformed)

          if (singleError) {
            console.error(`   ❌ Failed: ${item.calls || item.affiliate} - ${singleError.message}`)
            errorCount++
            errors.push({ calls: item.calls || item.affiliate, error: singleError.message })
          } else {
            successCount++
          }
        } catch (err) {
          console.error(`   ❌ Error processing ${item.calls || item.affiliate}:`, err.message)
          errorCount++
          errors.push({ calls: item.calls || item.affiliate, error: err.message })
        }
      }
    } else {
      successCount += batch.length
      console.log(`   ✅ Batch ${batchIndex + 1} completed: ${batch.length} broadcast TV entries`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('\n📊 Migration Summary:')
  console.log(`   ✅ Success: ${successCount} broadcast TV entries`)
  console.log(`   ❌ Failed: ${errorCount} broadcast TV entries`)

  if (errors.length > 0) {
    console.log('\n⚠️  Errors encountered:')
    errors.slice(0, 10).forEach(err => {
      console.log(`   - ${err.calls}: ${err.error}`)
    })
    if (errors.length > 10) {
      console.log(`   ... and ${errors.length - 10} more errors`)
    }
  }

  console.log('\n✅ Broadcast TV migration completed!\n')
}

migrateBroadcastTv().catch(console.error)

