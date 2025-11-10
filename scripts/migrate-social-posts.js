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

async function migrateSocialPosts() {
  console.log('\n🚀 Starting Social Posts Migration...\n')
  console.log('='.repeat(60))

  // Read social posts data
  const filePath = path.join(__dirname, '../data/socialPostData.json')
  const fileContent = fs.readFileSync(filePath, 'utf8')
  const socialPosts = JSON.parse(fileContent)

  console.log(`📊 Found ${socialPosts.length} social posts to migrate\n`)

  let successCount = 0
  let errorCount = 0
  const errors = []

  // Process in batches of 100
  const batchSize = 100
  const totalBatches = Math.ceil(socialPosts.length / batchSize)

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const start = batchIndex * batchSize
    const end = Math.min(start + batchSize, socialPosts.length)
    const batch = socialPosts.slice(start, end)

    console.log(`📦 Processing batch ${batchIndex + 1}/${totalBatches} (${start + 1}-${end})...`)

    const transformedBatch = batch.map(post => ({
      publication: post.publication || '',
      image: post.image || null,
      url: post.url || null,
      platforms: Array.isArray(post.platforms) ? post.platforms : [],
      price: post.price || null,
      tat: post.tat || null,
      example_url: post.exampleUrl || null
    }))

    // Insert batch
    const { data: insertedData, error } = await supabase
      .from('social_posts')
      .upsert(transformedBatch)

    if (error) {
      console.error(`❌ Batch ${batchIndex + 1} failed:`, error.message)
      
      // If batch fails, try one by one
      console.log(`   Trying individual inserts for this batch...`)
      for (const post of batch) {
        try {
          const transformed = {
            publication: post.publication || '',
            image: post.image || null,
            url: post.url || null,
            platforms: Array.isArray(post.platforms) ? post.platforms : [],
            price: post.price || null,
            tat: post.tat || null,
            example_url: post.exampleUrl || null
          }

          const { error: singleError } = await supabase
            .from('social_posts')
            .upsert(transformed)

          if (singleError) {
            console.error(`   ❌ Failed: ${post.publication} - ${singleError.message}`)
            errorCount++
            errors.push({ publication: post.publication, error: singleError.message })
          } else {
            successCount++
          }
        } catch (err) {
          console.error(`   ❌ Error processing ${post.publication}:`, err.message)
          errorCount++
          errors.push({ publication: post.publication, error: err.message })
        }
      }
    } else {
      successCount += batch.length
      console.log(`   ✅ Batch ${batchIndex + 1} completed: ${batch.length} social posts`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('\n📊 Migration Summary:')
  console.log(`   ✅ Success: ${successCount} social posts`)
  console.log(`   ❌ Failed: ${errorCount} social posts`)

  if (errors.length > 0) {
    console.log('\n⚠️  Errors encountered:')
    errors.slice(0, 10).forEach(err => {
      console.log(`   - ${err.publication}: ${err.error}`)
    })
    if (errors.length > 10) {
      console.log(`   ... and ${errors.length - 10} more errors`)
    }
  }

  console.log('\n✅ Social posts migration completed!\n')
}

migrateSocialPosts().catch(console.error)

