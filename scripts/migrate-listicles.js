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

async function migrateListicles() {
  console.log('\n🚀 Starting Listicles Migration...\n')
  console.log('='.repeat(60))

  // Read listicles data
  const filePath = path.join(__dirname, '../data/listiclesData.json')
  const fileContent = fs.readFileSync(filePath, 'utf8')
  const listicles = JSON.parse(fileContent)

  console.log(`📊 Found ${listicles.length} listicles to migrate\n`)

  let successCount = 0
  let errorCount = 0
  const errors = []

  // Process in batches of 100
  const batchSize = 100
  const totalBatches = Math.ceil(listicles.length / batchSize)

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const start = batchIndex * batchSize
    const end = Math.min(start + batchSize, listicles.length)
    const batch = listicles.slice(start, end)

    console.log(`📦 Processing batch ${batchIndex + 1}/${totalBatches} (${start + 1}-${end})...`)

    const transformedBatch = batch.map(item => ({
      publication: item.publication || '',
      image: item.image || null,
      genres: item.genres || null,
      price: item.price || null,
      da: item.da || null,
      dr: item.dr || null,
      tat: item.tat || null,
      region: item.region || null,
      sponsored: item.sponsored || null,
      indexed: item.indexed || null,
      dofollow: item.dofollow || null,
      example_url: item.exampleUrl || null,
      has_image: item.hasImage || null
    }))

    // Insert batch
    const { data: insertedData, error } = await supabase
      .from('listicles')
      .upsert(transformedBatch)

    if (error) {
      console.error(`❌ Batch ${batchIndex + 1} failed:`, error.message)
      
      // If batch fails, try one by one
      console.log(`   Trying individual inserts for this batch...`)
      for (const item of batch) {
        try {
          const transformed = {
            publication: item.publication || '',
            image: item.image || null,
            genres: item.genres || null,
            price: item.price || null,
            da: item.da || null,
            dr: item.dr || null,
            tat: item.tat || null,
            region: item.region || null,
            sponsored: item.sponsored || null,
            indexed: item.indexed || null,
            dofollow: item.dofollow || null,
            example_url: item.exampleUrl || null,
            has_image: item.hasImage || null
          }

          const { error: singleError } = await supabase
            .from('listicles')
            .upsert(transformed)

          if (singleError) {
            console.error(`   ❌ Failed: ${item.publication} - ${singleError.message}`)
            errorCount++
            errors.push({ publication: item.publication, error: singleError.message })
          } else {
            successCount++
          }
        } catch (err) {
          console.error(`   ❌ Error processing ${item.publication}:`, err.message)
          errorCount++
          errors.push({ publication: item.publication, error: err.message })
        }
      }
    } else {
      successCount += batch.length
      console.log(`   ✅ Batch ${batchIndex + 1} completed: ${batch.length} listicles`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('\n📊 Migration Summary:')
  console.log(`   ✅ Success: ${successCount} listicles`)
  console.log(`   ❌ Failed: ${errorCount} listicles`)

  if (errors.length > 0) {
    console.log('\n⚠️  Errors encountered:')
    errors.slice(0, 10).forEach(err => {
      console.log(`   - ${err.publication}: ${err.error}`)
    })
    if (errors.length > 10) {
      console.log(`   ... and ${errors.length - 10} more errors`)
    }
  }

  console.log('\n✅ Listicles migration completed!\n')
}

migrateListicles().catch(console.error)

