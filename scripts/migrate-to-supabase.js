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

// Helper function to log progress
function logProgress(message, type = 'info') {
  const icons = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warning: '⚠️'
  }
  console.log(`${icons[type] || 'ℹ️'} ${message}`)
}

// Migrate Publications
async function migratePublications() {
  try {
    logProgress('Starting publications migration...', 'info')
    const filePath = path.join(__dirname, '../data/publicationsData.json')
    const fileContent = fs.readFileSync(filePath, 'utf8')
    const data = JSON.parse(fileContent)
    const publications = data.result || []

    logProgress(`Found ${publications.length} publications to migrate`, 'info')

    let successCount = 0
    let errorCount = 0

    for (const pub of publications) {
      try {
        const { error } = await supabase
          .from('publications')
          .upsert({
            _id: pub._id,
            name: pub.name,
            logo: pub.logo,
            genres: pub.genres || [],
            default_price: pub.defaultPrice || [],
            custom_price: pub.customPrice || [],
            domain_authority: pub.domain_authority,
            domain_rating: pub.domain_rating,
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
          }, { onConflict: '_id' })

        if (error) {
          console.error(`Error importing ${pub.name}:`, error.message)
          errorCount++
        } else {
          successCount++
          if (successCount % 100 === 0) {
            logProgress(`Imported ${successCount} publications...`, 'info')
          }
        }
      } catch (err) {
        console.error(`Error processing ${pub.name}:`, err.message)
        errorCount++
      }
    }

    logProgress(`Publications migration complete: ${successCount} succeeded, ${errorCount} failed`, 
      errorCount > 0 ? 'warning' : 'success')
  } catch (error) {
    logProgress(`Publications migration failed: ${error.message}`, 'error')
  }
}

// Migrate Social Posts
async function migrateSocialPosts() {
  try {
    logProgress('Starting social posts migration...', 'info')
    const filePath = path.join(__dirname, '../data/socialPostData.json')
    const fileContent = fs.readFileSync(filePath, 'utf8')
    const data = JSON.parse(fileContent)

    logProgress(`Found ${data.length} social posts to migrate`, 'info')

    const transformed = data.map(item => ({
      publication: item.publication,
      image: item.image,
      url: item.url,
      platforms: item.platforms || [],
      price: item.price,
      tat: item.tat,
      example_url: item.exampleUrl
    }))

    const { error } = await supabase
      .from('social_posts')
      .upsert(transformed, { onConflict: 'id' })

    if (error) {
      logProgress(`Social posts migration failed: ${error.message}`, 'error')
    } else {
      logProgress(`Social posts migration complete: ${data.length} records`, 'success')
    }
  } catch (error) {
    logProgress(`Social posts migration failed: ${error.message}`, 'error')
  }
}

// Migrate Digital TV
async function migrateDigitalTV() {
  try {
    logProgress('Starting digital TV migration...', 'info')
    const filePath = path.join(__dirname, '../data/digitalTvData.json')
    const fileContent = fs.readFileSync(filePath, 'utf8')
    const data = JSON.parse(fileContent)

    logProgress(`Found ${data.length} digital TV records to migrate`, 'info')

    const transformed = data.map(item => ({
      call_sign: item.callSign,
      station: item.station,
      rate: item.rate,
      tat: item.tat,
      sponsored: item.sponsored,
      indexed: item.indexed,
      segment_length: item.segmentLength,
      location: item.location,
      program_name: item.programName,
      interview_type: item.interviewType,
      example_url: item.exampleUrl
    }))

    const { error } = await supabase
      .from('digital_tv')
      .upsert(transformed, { onConflict: 'id' })

    if (error) {
      logProgress(`Digital TV migration failed: ${error.message}`, 'error')
    } else {
      logProgress(`Digital TV migration complete: ${data.length} records`, 'success')
    }
  } catch (error) {
    logProgress(`Digital TV migration failed: ${error.message}`, 'error')
  }
}

// Migrate Best Sellers
async function migrateBestSellers() {
  try {
    logProgress('Starting best sellers migration...', 'info')
    const filePath = path.join(__dirname, '../data/bestSellersData.json')
    const fileContent = fs.readFileSync(filePath, 'utf8')
    const data = JSON.parse(fileContent)

    logProgress(`Found ${data.length} best sellers to migrate`, 'info')

    const transformed = data.map(item => ({
      publication: item.publication,
      image: item.image,
      genres: item.genres,
      price: item.price,
      da: item.da,
      dr: item.dr,
      tat: item.tat,
      region: item.region,
      sponsored: item.sponsored,
      indexed: item.indexed,
      dofollow: item.dofollow,
      example_url: item.exampleUrl,
      has_image: item.hasImage,
      niches: item.niches
    }))

    const { error } = await supabase
      .from('best_sellers')
      .upsert(transformed, { onConflict: 'id' })

    if (error) {
      logProgress(`Best sellers migration failed: ${error.message}`, 'error')
    } else {
      logProgress(`Best sellers migration complete: ${data.length} records`, 'success')
    }
  } catch (error) {
    logProgress(`Best sellers migration failed: ${error.message}`, 'error')
  }
}

// Migrate Listicles
async function migrateListicles() {
  try {
    logProgress('Starting listicles migration...', 'info')
    const filePath = path.join(__dirname, '../data/listiclesData.json')
    const fileContent = fs.readFileSync(filePath, 'utf8')
    const data = JSON.parse(fileContent)

    logProgress(`Found ${data.length} listicles to migrate`, 'info')

    const transformed = data.map(item => ({
      publication: item.publication,
      image: item.image,
      genres: item.genres,
      price: item.price,
      da: item.da,
      dr: item.dr,
      tat: item.tat,
      region: item.region,
      sponsored: item.sponsored,
      indexed: item.indexed,
      dofollow: item.dofollow,
      example_url: item.exampleUrl,
      has_image: item.hasImage
    }))

    const { error } = await supabase
      .from('listicles')
      .upsert(transformed, { onConflict: 'id' })

    if (error) {
      logProgress(`Listicles migration failed: ${error.message}`, 'error')
    } else {
      logProgress(`Listicles migration complete: ${data.length} records`, 'success')
    }
  } catch (error) {
    logProgress(`Listicles migration failed: ${error.message}`, 'error')
  }
}

// Migrate PR Bundles
async function migratePRBundles() {
  try {
    logProgress('Starting PR bundles migration...', 'info')
    const filePath = path.join(__dirname, '../data/prBundlesData.json')
    const fileContent = fs.readFileSync(filePath, 'utf8')
    const data = JSON.parse(fileContent)

    logProgress(`Found ${data.length} PR bundle categories to migrate`, 'info')

    const transformed = data.map(item => ({
      category: item.category,
      bundles: item.bundles || []
    }))

    const { error } = await supabase
      .from('pr_bundles')
      .upsert(transformed, { onConflict: 'id' })

    if (error) {
      logProgress(`PR bundles migration failed: ${error.message}`, 'error')
    } else {
      logProgress(`PR bundles migration complete: ${data.length} records`, 'success')
    }
  } catch (error) {
    logProgress(`PR bundles migration failed: ${error.message}`, 'error')
  }
}

// Migrate Print
async function migratePrint() {
  try {
    logProgress('Starting print migration...', 'info')
    const filePath = path.join(__dirname, '../data/printData.json')
    const fileContent = fs.readFileSync(filePath, 'utf8')
    const data = JSON.parse(fileContent)

    logProgress(`Found ${data.length} print categories to migrate`, 'info')

    const transformed = data.map(item => ({
      category: item.category,
      magazines: item.magazines || []
    }))

    const { error } = await supabase
      .from('print')
      .upsert(transformed, { onConflict: 'id' })

    if (error) {
      logProgress(`Print migration failed: ${error.message}`, 'error')
    } else {
      logProgress(`Print migration complete: ${data.length} records`, 'success')
    }
  } catch (error) {
    logProgress(`Print migration failed: ${error.message}`, 'error')
  }
}

// Migrate Broadcast TV
async function migrateBroadcastTV() {
  try {
    logProgress('Starting broadcast TV migration...', 'info')
    const filePath = path.join(__dirname, '../data/tableData.json')
    const fileContent = fs.readFileSync(filePath, 'utf8')
    const data = JSON.parse(fileContent)

    logProgress(`Found ${data.length} broadcast TV records to migrate`, 'info')

    const transformed = data.map(item => ({
      affiliate: item.affiliate,
      calls: item.calls,
      state: item.state,
      market: item.market,
      program: item.program,
      location: item.location,
      time: item.time,
      rate: item.rate,
      example_url: item.exampleUrl,
      intake_url: item.intakeUrl
    }))

    const { error } = await supabase
      .from('broadcast_tv')
      .upsert(transformed, { onConflict: 'id' })

    if (error) {
      logProgress(`Broadcast TV migration failed: ${error.message}`, 'error')
    } else {
      logProgress(`Broadcast TV migration complete: ${data.length} records`, 'success')
    }
  } catch (error) {
    logProgress(`Broadcast TV migration failed: ${error.message}`, 'error')
  }
}

// Main migration function
async function runMigrations() {
  console.log('\n🚀 Starting Supabase Migration...\n')
  console.log('=' .repeat(50))

  await migratePublications()
  await migrateSocialPosts()
  await migrateDigitalTV()
  await migrateBestSellers()
  await migrateListicles()
  await migratePRBundles()
  await migratePrint()
  await migrateBroadcastTV()

  console.log('\n' + '='.repeat(50))
  logProgress('All migrations completed!', 'success')
  console.log('\n')
}

// Run migrations
runMigrations().catch(console.error)



