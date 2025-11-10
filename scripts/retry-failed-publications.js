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

async function retryFailedPublications() {
  console.log('\n🔄 Retrying Failed Publications Migration...\n')
  console.log('='.repeat(60))

  // Read publications data
  const filePath = path.join(__dirname, '../data/publicationsData.json')
  const fileContent = fs.readFileSync(filePath, 'utf8')
  const data = JSON.parse(fileContent)
  const publications = data.result || []

  // Find the failed publications by name
  const failedNames = ['Latitude 33 Magazine', 'Health Mind Magazine']
  const failedPublications = publications.filter(pub => failedNames.includes(pub.name))

  console.log(`📊 Found ${failedPublications.length} failed publications to retry\n`)

  let successCount = 0
  let errorCount = 0

  for (const pub of failedPublications) {
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
      listicles: pub.listicles || null,
      more_info: pub.moreInfo,
      sale_expire_date: pub.saleExpireDate,
      sale_price: pub.salePrice != null ? (typeof pub.salePrice === 'string' ? parseFloat(pub.salePrice) : pub.salePrice) : null,
      show_on_sale: pub.showOnSale,
      slug: pub.slug,
      img_explain: pub.img_explain
    }

    const { error } = await supabase
      .from('publications')
      .upsert(transformed, { onConflict: '_id' })

    if (error) {
      console.error(`   ❌ Failed: ${pub.name} - ${error.message}`)
      errorCount++
    } else {
      console.log(`   ✅ Success: ${pub.name}`)
      successCount++
    }
  } catch (err) {
    console.error(`   ❌ Error processing ${pub.name}:`, err.message)
    errorCount++
  }
}

  console.log('\n' + '='.repeat(60))
  console.log(`\n📊 Retry Summary:`)
  console.log(`   ✅ Success: ${successCount}`)
  console.log(`   ❌ Failed: ${errorCount}`)
  console.log('\n')
}

// Run the retry
retryFailedPublications().catch(console.error)

