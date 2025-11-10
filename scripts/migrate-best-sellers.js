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

async function migrateBestSellers() {
  console.log('\n🚀 Starting Best Sellers Migration...\n')
  console.log('='.repeat(60))

  // Read best sellers data
  const filePath = path.join(__dirname, '../data/bestSellersData.json')
  const fileContent = fs.readFileSync(filePath, 'utf8')
  const bestSellers = JSON.parse(fileContent)

  console.log(`📊 Found ${bestSellers.length} best sellers to migrate\n`)

  let successCount = 0
  let errorCount = 0
  const errors = []

  // Process in batches of 100
  const batchSize = 100
  const totalBatches = Math.ceil(bestSellers.length / batchSize)

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const start = batchIndex * batchSize
    const end = Math.min(start + batchSize, bestSellers.length)
    const batch = bestSellers.slice(start, end)

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
      has_image: item.hasImage || null,
      niches: item.niches || null
    }))

    // Insert batch
    const { data: insertedData, error } = await supabase
      .from('best_sellers')
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
            has_image: item.hasImage || null,
            niches: item.niches || null
          }

          const { error: singleError } = await supabase
            .from('best_sellers')
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
      console.log(`   ✅ Batch ${batchIndex + 1} completed: ${batch.length} best sellers`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('\n📊 Migration Summary:')
  console.log(`   ✅ Success: ${successCount} best sellers`)
  console.log(`   ❌ Failed: ${errorCount} best sellers`)

  if (errors.length > 0) {
    console.log('\n⚠️  Errors encountered:')
    errors.slice(0, 10).forEach(err => {
      console.log(`   - ${err.publication}: ${err.error}`)
    })
    if (errors.length > 10) {
      console.log(`   ... and ${errors.length - 10} more errors`)
    }
  }

  console.log('\n✅ Best sellers migration completed!\n')
}

migrateBestSellers().catch(console.error)

