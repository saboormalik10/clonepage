const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Supabase credentials not found!')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

console.log('\n🚀 Automatic Supabase Schema Setup\n')
console.log('='.repeat(60))
console.log('📋 This script will create tables and RLS policies automatically')
console.log('='.repeat(60) + '\n')

// Read SQL file
const sqlFile = path.join(__dirname, 'schema.sql')
const fullSQL = fs.readFileSync(sqlFile, 'utf8')

// Split into individual statements
const statements = fullSQL
  .split(';')
  .map(s => s.trim().replace(/--.*$/gm, '').trim())
  .filter(s => s.length > 10 && !s.toLowerCase().startsWith('--'))

console.log(`Found ${statements.length} SQL statements to execute\n`)

async function executeStatement(statement, index, total) {
  const preview = statement.substring(0, 50).replace(/\n/g, ' ')
  
  try {
    // Use Supabase's REST API to execute SQL
    // Note: This requires the exec_sql function to be created first
    const { data, error } = await supabase.rpc('exec_sql', {
      sql_text: statement + ';'
    })

    if (error) {
      // Check for "already exists" errors (these are OK)
      if (error.message && (
        error.message.includes('already exists') ||
        error.message.includes('duplicate key') ||
        error.message.includes('does not exist') // For DROP IF EXISTS
      )) {
        console.log(`   ⚠️  [${index}/${total}] ${preview}... (already exists)`)
        return { success: true, skipped: true }
      }
      
      console.error(`   ❌ [${index}/${total}] Error: ${error.message.substring(0, 80)}`)
      return { success: false, error: error.message }
    }

    console.log(`   ✅ [${index}/${total}] ${preview}...`)
    return { success: true }
  } catch (err) {
    console.error(`   ❌ [${index}/${total}] Exception: ${err.message}`)
    return { success: false, error: err.message }
  }
}

async function setupSchema() {
  // First, try to create the helper function
  console.log('📋 Step 1: Setting up SQL execution helper...')
  
  const helperSQL = `
    CREATE OR REPLACE FUNCTION exec_sql(sql_text text)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
      EXECUTE sql_text;
    END;
    $$;
  `

  // Try to execute helper function creation via direct API call
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({ sql_text: helperSQL })
    })

    if (response.ok) {
      console.log('   ✅ Helper function ready\n')
    } else {
      console.log('   ⚠️  Helper function may need manual creation')
      console.log('   📄 Run scripts/create-helper-function.sql in Supabase SQL Editor first\n')
    }
  } catch (err) {
    console.log('   ⚠️  Could not verify helper function')
    console.log('   📄 Please run scripts/create-helper-function.sql in Supabase SQL Editor first\n')
  }

  // Execute all statements
  console.log('📋 Step 2: Executing schema statements...\n')
  
  let successCount = 0
  let skippedCount = 0
  let errorCount = 0

  for (let i = 0; i < statements.length; i++) {
    const result = await executeStatement(statements[i], i + 1, statements.length)
    
    if (result.success) {
      if (result.skipped) {
        skippedCount++
      } else {
        successCount++
      }
    } else {
      errorCount++
    }

    // Small delay to avoid rate limiting
    if (i < statements.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('\n📊 Summary:')
  console.log(`   ✅ Executed: ${successCount}`)
  console.log(`   ⚠️  Skipped (already exists): ${skippedCount}`)
  console.log(`   ❌ Failed: ${errorCount}`)

  if (errorCount > 0) {
    console.log('\n💡 Tip: Some statements may need manual execution')
    console.log('   Run scripts/schema.sql in Supabase SQL Editor')
  } else {
    console.log('\n✅ Schema setup completed!')
  }
  console.log('\n')
}

setupSchema().catch(console.error)



