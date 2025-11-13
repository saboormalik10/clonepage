const { createClient } = require('@supabase/supabase-js')

// Destination Supabase (Credentials 2)
const DEST_URL = 'https://fzorirzobvypsachtwkx.supabase.co'
const DEST_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6b3JpcnpvYnZ5cHNhY2h0d2t4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk1ODM4NCwiZXhwIjoyMDc4NTM0Mzg0fQ.k0GX7-GARsz80MdyBxw5alASDd7W9_aWdPANXuJQgN8'

const supabase = createClient(DEST_URL, DEST_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createProfilesSQL() {
  try {
    console.log('\n🔐 Create Profiles for Auth Users (SQL Method)\n')
    console.log('='.repeat(60))

    // SQL to get all users and create/update profiles
    const sql = `
      -- Create profiles for all auth users that don't have profiles
      INSERT INTO user_profiles (id, email, role)
      SELECT 
        au.id,
        au.email,
        'admin' as role
      FROM auth.users au
      LEFT JOIN user_profiles up ON au.id = up.id
      WHERE up.id IS NULL
      ON CONFLICT (id) DO UPDATE 
      SET role = 'admin', email = EXCLUDED.email;
    `

    console.log('\n📝 Executing SQL to create/update profiles...')
    console.log('\nSQL:')
    console.log(sql)
    console.log('\n⚠️  Since exec_sql might not be available, here\'s the SQL to run manually:')
    console.log('='.repeat(60))
    console.log(sql)
    console.log('='.repeat(60))
    console.log('\n💡 Run this SQL in your Supabase SQL Editor:')
    console.log('   https://app.supabase.com/project/fzorirzobvypsachtwkx/sql\n')

    // Try to execute via RPC
    try {
      const { error: rpcError } = await supabase.rpc('exec_sql', { sql_text: sql })
      if (rpcError) {
        console.log('⚠️  Could not execute via RPC (function may not exist)')
        console.log('   Please run the SQL manually in Supabase SQL Editor\n')
      } else {
        console.log('✅ SQL executed successfully!\n')
      }
    } catch (err) {
      console.log('⚠️  Could not execute via RPC')
      console.log('   Please run the SQL manually in Supabase SQL Editor\n')
    }

    // Also provide individual SQL for each email
    console.log('\n📋 Alternative: Create profiles for specific emails\n')
    console.log('If you know the user IDs, you can also run:')
    console.log('\n-- For admin@gmail.com:')
    console.log('INSERT INTO user_profiles (id, email, role)')
    console.log('SELECT id, email, \'admin\' FROM auth.users WHERE email = \'admin@gmail.com\'')
    console.log('ON CONFLICT (id) DO UPDATE SET role = \'admin\';')
    console.log('\n-- For admin@example.com:')
    console.log('INSERT INTO user_profiles (id, email, role)')
    console.log('SELECT id, email, \'admin\' FROM auth.users WHERE email = \'admin@example.com\'')
    console.log('ON CONFLICT (id) DO UPDATE SET role = \'admin\';\n')

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error)
  }
}

createProfilesSQL()

