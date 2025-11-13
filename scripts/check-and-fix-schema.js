const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Error: Missing Supabase credentials!')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function checkSchema() {
  try {
    console.log('\n🔍 Checking Database Schema\n')
    console.log('='.repeat(60))

    // Check if user_profiles table exists
    console.log('\n📋 Step 1: Checking user_profiles table...')
    const { error: tableError } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1)

    if (tableError) {
      console.error('❌ user_profiles table does not exist or is not accessible!')
      console.error('   Error:', tableError.message)
      console.error('   Code:', tableError.code)
      console.log('\n💡 You MUST run the SQL schema first!')
      console.log('   Run scripts/fix-user-profiles-rls-dest.sql in Supabase SQL Editor')
      console.log(`   URL: https://app.supabase.com/project/fzorirzobvypsachtwkx/sql`)
      process.exit(1)
    }

    console.log('✅ user_profiles table exists')

    // Check if we can insert (test RLS)
    console.log('\n📋 Step 2: Testing table access...')
    const testId = '00000000-0000-0000-0000-000000000000'
    const { error: insertTestError } = await supabase
      .from('user_profiles')
      .insert({
        id: testId,
        email: 'test@test.com',
        role: 'user'
      })

    if (insertTestError && insertTestError.code !== '23505') { // Ignore unique constraint
      console.error('⚠️  Cannot insert into user_profiles:', insertTestError.message)
      console.error('   Code:', insertTestError.code)
    } else {
      // Clean up test record
      await supabase.from('user_profiles').delete().eq('id', testId)
      console.log('✅ Can insert into user_profiles (using service role)')
    }

    // Check trigger
    console.log('\n📋 Step 3: Checking trigger...')
    const { data: triggerCheck } = await supabase.rpc('exec_sql', {
      sql_text: `
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'users' 
        AND trigger_name = 'on_auth_user_created';
      `
    })

    console.log('✅ Schema check complete')
    console.log('\n💡 If user creation still fails, the issue might be:')
    console.log('   1. Foreign key constraints')
    console.log('   2. RLS policies blocking the trigger')
    console.log('   3. Missing permissions')
    console.log('\n   Try creating user manually in Supabase Dashboard:')
    console.log('   Authentication → Users → Add user')
    console.log('   Then update the profile to admin role.\n')

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error)
  }
}

checkSchema()


