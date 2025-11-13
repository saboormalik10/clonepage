const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing required environment variables:')
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗')
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? '✓' : '✗')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function addExactAmountColumns() {
  console.log('🔄 Adding exact_amount columns to price adjustment tables...\n')

  try {
    // Add exact_amount to global_price_adjustments
    console.log('📝 Adding exact_amount to global_price_adjustments...')
    const { error: globalError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE global_price_adjustments 
        ADD COLUMN IF NOT EXISTS exact_amount DECIMAL(10, 2) DEFAULT NULL;
        
        COMMENT ON COLUMN global_price_adjustments.exact_amount IS 
        'Exact dollar amount to replace price (if set, replaces adjustment_percentage)';
      `
    })

    if (globalError) {
      // Try direct SQL execution if RPC doesn't work
      console.log('⚠️  RPC method failed, trying direct SQL...')
      const { error: directError } = await supabase
        .from('global_price_adjustments')
        .select('exact_amount')
        .limit(1)

      if (directError && directError.code === '42703') {
        // Column doesn't exist, need to add it via Supabase dashboard or SQL editor
        console.log('⚠️  Column does not exist. Please run the SQL manually in Supabase SQL Editor:')
        console.log('\n' + '='.repeat(60))
        console.log(`
ALTER TABLE global_price_adjustments 
ADD COLUMN IF NOT EXISTS exact_amount DECIMAL(10, 2) DEFAULT NULL;

ALTER TABLE user_price_adjustments 
ADD COLUMN IF NOT EXISTS exact_amount DECIMAL(10, 2) DEFAULT NULL;

COMMENT ON COLUMN global_price_adjustments.exact_amount IS 
'Exact dollar amount to replace price (if set, replaces adjustment_percentage)';

COMMENT ON COLUMN user_price_adjustments.exact_amount IS 
'Exact dollar amount to replace price (if set, replaces adjustment_percentage)';
        `)
        console.log('='.repeat(60) + '\n')
      }
    } else {
      console.log('✅ Added exact_amount to global_price_adjustments')
    }

    // Add exact_amount to user_price_adjustments
    console.log('📝 Adding exact_amount to user_price_adjustments...')
    const { error: userError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE user_price_adjustments 
        ADD COLUMN IF NOT EXISTS exact_amount DECIMAL(10, 2) DEFAULT NULL;
        
        COMMENT ON COLUMN user_price_adjustments.exact_amount IS 
        'Exact dollar amount to replace price (if set, replaces adjustment_percentage)';
      `
    })

    if (userError) {
      console.log('⚠️  RPC method failed for user_price_adjustments')
    } else {
      console.log('✅ Added exact_amount to user_price_adjustments')
    }

    console.log('\n✅ Migration completed!')
    console.log('\n📋 Next steps:')
    console.log('   1. If the columns were not added automatically, run the SQL in Supabase SQL Editor')
    console.log('   2. The SQL file is located at: scripts/add-exact-amount-column.sql')
    console.log('   3. Restart your Next.js development server')

  } catch (error) {
    console.error('❌ Error running migration:', error.message)
    console.error('\n📋 Please run the SQL manually in Supabase SQL Editor:')
    console.error('   File: scripts/add-exact-amount-column.sql')
    process.exit(1)
  }
}

addExactAmountColumns()

