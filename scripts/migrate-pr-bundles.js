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

async function migratePRBundles() {
  console.log('\n🚀 Starting PR Bundles Migration...\n')
  console.log('='.repeat(60))

  // Read PR bundles data
  const filePath = path.join(__dirname, '../data/prBundlesData.json')
  const fileContent = fs.readFileSync(filePath, 'utf8')
  const prBundles = JSON.parse(fileContent)

  console.log(`📊 Found ${prBundles.length} PR bundle categories to migrate\n`)

  let successCount = 0
  let errorCount = 0
  const errors = []

  for (let i = 0; i < prBundles.length; i++) {
    const item = prBundles[i]
    
    try {
      const transformed = {
        category: item.category || '',
        bundles: item.bundles || []
      }

      // Delete existing records with same category first to avoid duplicates
      await supabase.from('pr_bundles').delete().eq('category', transformed.category)
      
      const { error } = await supabase
        .from('pr_bundles')
        .insert(transformed)

      if (error) {
        console.error(`   ❌ Failed: ${item.category} - ${error.message}`)
        errorCount++
        errors.push({ category: item.category, error: error.message })
      } else {
        console.log(`   ✅ ${i + 1}/${prBundles.length}: ${item.category} (${item.bundles?.length || 0} bundles)`)
        successCount++
      }
    } catch (err) {
      console.error(`   ❌ Error processing ${item.category}:`, err.message)
      errorCount++
      errors.push({ category: item.category, error: err.message })
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('\n📊 Migration Summary:')
  console.log(`   ✅ Success: ${successCount} PR bundle categories`)
  console.log(`   ❌ Failed: ${errorCount} PR bundle categories`)

  if (errors.length > 0) {
    console.log('\n⚠️  Errors encountered:')
    errors.forEach(err => {
      console.log(`   - ${err.category}: ${err.error}`)
    })
  }

  console.log('\n✅ PR bundles migration completed!\n')
}

migratePRBundles().catch(console.error)

