const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Supabase credentials not found!')
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function migratePublications() {
  console.log('\n🚀 Starting Publications Migration...\n')
  console.log('='.repeat(60))

  // Read publications data
  const filePath = path.join(__dirname, '../data/publicationsData.json')
  const fileContent = fs.readFileSync(filePath, 'utf8')
  const data = JSON.parse(fileContent)
  const publications = data.result || []

  console.log(`📊 Found ${publications.length} publications to migrate\n`)

  let successCount = 0
  let errorCount = 0
  const errors = []

  // Process in batches of 100
  const batchSize = 100
  const totalBatches = Math.ceil(publications.length / batchSize)

  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
    const start = batchIndex * batchSize
    const end = Math.min(start + batchSize, publications.length)
    const batch = publications.slice(start, end)

    console.log(`📦 Processing batch ${batchIndex + 1}/${totalBatches} (${start + 1}-${end})...`)

    const transformedBatch = batch.map(pub => ({
      _id: pub._id,
      name: pub.name,
      logo: pub.logo,
      genres: pub.genres || [],
      default_price: Array.isArray(pub.defaultPrice) ? pub.defaultPrice : (pub.defaultPrice ? [pub.defaultPrice] : []),
      custom_price: Array.isArray(pub.customPrice) ? pub.customPrice : (pub.customPrice ? [pub.customPrice] : []),
      domain_authority: pub.domain_authority != null ? (typeof pub.domain_authority === 'string' ? parseFloat(pub.domain_authority) : pub.domain_authority) : null,
      domain_rating: pub.domain_rating != null ? (typeof pub.domain_rating === 'string' ? parseFloat(pub.domain_rating) : pub.domain_rating) : null,
      estimated_time: pub.estimated_time,
      regions: pub.regions || [],
      sponsored: pub.sponsored,
      indexed: pub.indexed,
      do_follow: pub.do_follow,
      article_preview: pub.articlePreview,
      image: pub.image,
      url: pub.url,
      health: pub.health,
      health_multiplier: pub.healthMultiplier,
      cbd: pub.cbd,
      cbd_multiplier: pub.cbdMultiplier,
      crypto: pub.crypto,
      crypto_multiplier: pub.cryptoMultiplier,
      gambling: pub.gambling,
      gambling_multiplier: pub.gamblingMultiplier,
      erotic: pub.erotic,
      erotic_multiplier: pub.eroticMultiplier,
      erotic_price: pub.eroticPrice,
      badges: pub.badges || [],
      business: pub.business || null,
      is_presale: pub.isPresale,
      listicles: pub.listicles || null,
      more_info: pub.moreInfo,
      sale_expire_date: pub.saleExpireDate,
      sale_price: pub.salePrice != null ? (typeof pub.salePrice === 'string' ? parseFloat(pub.salePrice) : pub.salePrice) : null,
      show_on_sale: pub.showOnSale,
      slug: pub.slug,
      img_explain: pub.img_explain
    }))

    // Insert batch
    const { data: insertedData, error } = await supabase
      .from('publications')
      .upsert(transformedBatch, { onConflict: '_id' })

    if (error) {
      console.error(`❌ Batch ${batchIndex + 1} failed:`, error.message)
      
      // If batch fails, try one by one
      console.log(`   Trying individual inserts for this batch...`)
      for (const pub of batch) {
        try {
          const transformed = {
            _id: pub._id,
            name: pub.name,
            logo: pub.logo,
            genres: pub.genres || [],
            default_price: Array.isArray(pub.defaultPrice) ? pub.defaultPrice : (pub.defaultPrice ? [pub.defaultPrice] : []),
            custom_price: Array.isArray(pub.customPrice) ? pub.customPrice : (pub.customPrice ? [pub.customPrice] : []),
            domain_authority: pub.domain_authority != null ? (typeof pub.domain_authority === 'string' ? parseFloat(pub.domain_authority) : pub.domain_authority) : null,
            domain_rating: pub.domain_rating != null ? (typeof pub.domain_rating === 'string' ? parseFloat(pub.domain_rating) : pub.domain_rating) : null,
            estimated_time: pub.estimated_time,
            regions: pub.regions || [],
            sponsored: pub.sponsored,
            indexed: pub.indexed,
            do_follow: pub.do_follow,
            article_preview: pub.articlePreview,
            image: pub.image,
            url: pub.url,
            health: pub.health,
            health_multiplier: pub.healthMultiplier,
            cbd: pub.cbd,
            cbd_multiplier: pub.cbdMultiplier,
            crypto: pub.crypto,
            crypto_multiplier: pub.cryptoMultiplier,
            gambling: pub.gambling,
            gambling_multiplier: pub.gamblingMultiplier,
            erotic: pub.erotic,
            erotic_multiplier: pub.eroticMultiplier,
            erotic_price: pub.eroticPrice,
            badges: pub.badges || [],
            business: pub.business || null,
            is_presale: pub.isPresale,
            listicles: pub.listicles,
            more_info: pub.moreInfo,
            sale_expire_date: pub.saleExpireDate,
            sale_price: pub.salePrice != null ? (typeof pub.salePrice === 'string' ? parseFloat(pub.salePrice) : pub.salePrice) : null,
            show_on_sale: pub.showOnSale,
            slug: pub.slug,
            img_explain: pub.img_explain
          }

          const { error: singleError } = await supabase
            .from('publications')
            .upsert(transformed, { onConflict: '_id' })

          if (singleError) {
            console.error(`   ❌ Failed: ${pub.name} - ${singleError.message}`)
            errorCount++
            errors.push({ name: pub.name, error: singleError.message })
          } else {
            successCount++
          }
        } catch (err) {
          console.error(`   ❌ Error processing ${pub.name}:`, err.message)
          errorCount++
          errors.push({ name: pub.name, error: err.message })
        }
      }
    } else {
      successCount += batch.length
      console.log(`   ✅ Batch ${batchIndex + 1} completed: ${batch.length} publications`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('\n📊 Migration Summary:')
  console.log(`   ✅ Success: ${successCount} publications`)
  console.log(`   ❌ Failed: ${errorCount} publications`)

  if (errors.length > 0) {
    console.log('\n⚠️  Errors encountered:')
    errors.slice(0, 10).forEach(err => {
      console.log(`   - ${err.name}: ${err.error}`)
    })
    if (errors.length > 10) {
      console.log(`   ... and ${errors.length - 10} more errors`)
    }
  }

  console.log('\n✅ Publications migration completed!\n')
}

// Run the migration
migratePublications().catch(console.error)

