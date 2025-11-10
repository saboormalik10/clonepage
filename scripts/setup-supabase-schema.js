const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL not found!')
  process.exit(1)
}

// Read the SQL file
const sqlFile = path.join(__dirname, 'schema.sql')
const sql = fs.readFileSync(sqlFile, 'utf8')

async function setupSchema() {
  console.log('\n🚀 Setting up Supabase Schema...\n')
  console.log('='.repeat(60))

  if (!serviceRoleKey) {
    console.log('⚠️  SUPABASE_SERVICE_ROLE_KEY not found')
    console.log('\n📋 To enable automatic schema setup:')
    console.log('   1. Go to Supabase Dashboard → Settings → API')
    console.log('   2. Copy the "service_role" key (keep it secret!)')
    console.log('   3. Add to .env.local: SUPABASE_SERVICE_ROLE_KEY=your_key')
    console.log('\n📄 For now, please run scripts/schema.sql in Supabase SQL Editor\n')
    console.log('='.repeat(60))
    return
  }

  // Create Supabase client with service role key
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  // First, create a helper function to execute SQL
  console.log('📋 Step 1: Creating SQL execution helper function...')
  
  const createHelperFunctionSQL = `
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

  try {
    // Try to create the helper function via direct SQL execution
    // We'll use the REST API to call a function that executes SQL
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify({ sql_text: createHelperFunctionSQL })
    })

    if (!response.ok) {
      console.log('⚠️  Helper function may already exist or need manual creation')
    } else {
      console.log('✅ Helper function created')
    }
  } catch (err) {
    console.log('⚠️  Could not create helper function automatically')
  }

  // Split SQL into statements
  const statements = sql
    .split(';')
    .map(s => s.trim().replace(/--.*$/gm, '').trim())
    .filter(s => s.length > 10 && !s.toLowerCase().startsWith('--'))
    .map(s => s + ';')

  console.log(`\n📋 Step 2: Executing ${statements.length} SQL statements...\n`)

  let successCount = 0
  let errorCount = 0
  const errors = []

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]
    const preview = statement.substring(0, 60).replace(/\n/g, ' ')

    try {
      // Try executing via the helper function
      const { error } = await supabase.rpc('exec_sql', { 
        sql_text: statement 
      })

      if (error) {
        // Check if it's a "already exists" error (which is OK)
        if (error.message && (
          error.message.includes('already exists') ||
          error.message.includes('duplicate') ||
          error.message.includes('does not exist') // For DROP IF EXISTS
        )) {
          console.log(`   ⚠️  ${i + 1}/${statements.length}: ${preview}... (skipped - already exists)`)
          successCount++
        } else {
          console.error(`   ❌ ${i + 1}/${statements.length}: ${error.message}`)
          errorCount++
          errors.push({ statement: preview, error: error.message })
        }
      } else {
        console.log(`   ✅ ${i + 1}/${statements.length}: ${preview}...`)
        successCount++
      }
    } catch (err) {
      console.error(`   ❌ ${i + 1}/${statements.length}: ${err.message}`)
      errorCount++
      errors.push({ statement: preview, error: err.message })
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log(`\n📊 Summary:`)
  console.log(`   ✅ Success: ${successCount}`)
  console.log(`   ❌ Failed: ${errorCount}`)

  if (errorCount > 0) {
    console.log('\n⚠️  Some statements failed. Errors:')
    errors.slice(0, 5).forEach(err => {
      console.log(`   - ${err.statement}: ${err.error}`)
    })
    if (errors.length > 5) {
      console.log(`   ... and ${errors.length - 5} more`)
    }
    console.log('\n💡 Tip: Run scripts/schema.sql manually in Supabase SQL Editor')
  } else {
    console.log('\n✅ Schema setup completed successfully!')
  }
  console.log('\n')
}

// Try Supabase CLI first (most reliable)
async function tryCLI() {
  try {
    const { execSync } = require('child_process')
    
    // Check if CLI is installed
    try {
      execSync('supabase --version', { stdio: 'ignore' })
    } catch {
      return false
    }

    console.log('📋 Using Supabase CLI...\n')
    
    // Try to execute
    try {
      execSync(`supabase db push --file ${sqlFile}`, {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      })
      console.log('\n✅ Schema setup completed via Supabase CLI!')
      return true
    } catch (err) {
      return false
    }
  } catch {
    return false
  }
}

// Main
async function main() {
  // Try CLI first
  const cliSuccess = await tryCLI()
  if (cliSuccess) return

  // Fall back to API method
  await setupSchema()
}

main().catch(console.error)
