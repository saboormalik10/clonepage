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

async function migratePrint() {
  console.log('\n🚀 Starting Print Migration...\n')
  console.log('='.repeat(60))

  // Read print data
  const filePath = path.join(__dirname, '../data/printData.json')
  const fileContent = fs.readFileSync(filePath, 'utf8')
  const printData = JSON.parse(fileContent)

  console.log(`📊 Found ${printData.length} print categories to migrate\n`)

  let successCount = 0
  let errorCount = 0
  const errors = []

  for (let i = 0; i < printData.length; i++) {
    const item = printData[i]
    
    try {
      const transformed = {
        category: item.category || '',
        magazines: item.magazines || []
      }

      // Delete existing records with same category first to avoid duplicates
      await supabase.from('print').delete().eq('category', transformed.category)
      
      const { error } = await supabase
        .from('print')
        .insert(transformed)

      if (error) {
        console.error(`   ❌ Failed: ${item.category} - ${error.message}`)
        errorCount++
        errors.push({ category: item.category, error: error.message })
      } else {
        console.log(`   ✅ ${i + 1}/${printData.length}: ${item.category} (${item.magazines?.length || 0} magazines)`)
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
  console.log(`   ✅ Success: ${successCount} print categories`)
  console.log(`   ❌ Failed: ${errorCount} print categories`)

  if (errors.length > 0) {
    console.log('\n⚠️  Errors encountered:')
    errors.forEach(err => {
      console.log(`   - ${err.category}: ${err.error}`)
    })
  }

  console.log('\n✅ Print migration completed!\n')
}

migratePrint().catch(console.error)

