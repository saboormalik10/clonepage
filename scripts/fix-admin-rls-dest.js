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

async function fixRLS() {
  try {
    console.log('\n🔧 Fixing RLS Policies for user_profiles\n')
    console.log('='.repeat(60))

    // SQL statements to fix RLS
    const sqlStatements = [
      // Drop existing policies if they exist
      `DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;`,
      `DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;`,
      `DROP POLICY IF EXISTS "Admins can insert profiles" ON user_profiles;`,
      `DROP POLICY IF EXISTS "Admins can update profiles" ON user_profiles;`,
      `DROP POLICY IF EXISTS "Admins can delete profiles" ON user_profiles;`,
      
      // Recreate policies
      `CREATE POLICY "Users can view own profile" ON user_profiles
        FOR SELECT USING (auth.uid() = id);`,
      
      `CREATE POLICY "Admins can view all profiles" ON user_profiles
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
          )
        );`,
      
      `CREATE POLICY "Admins can insert profiles" ON user_profiles
        FOR INSERT WITH CHECK (
          EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
          )
        );`,
      
      `CREATE POLICY "Admins can update profiles" ON user_profiles
        FOR UPDATE USING (
          EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
          )
        );`,
      
      `CREATE POLICY "Admins can delete profiles" ON user_profiles
        FOR DELETE USING (
          EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid() AND role = 'admin'
          )
        );`,
    ]

    // Execute each statement
    for (const sql of sqlStatements) {
      try {
        // Use RPC exec_sql if available, otherwise use direct SQL
        const { error } = await supabase.rpc('exec_sql', { sql_text: sql })
        
        if (error) {
          // Try alternative method - use REST API directly
          const response = await fetch(`${DEST_URL}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': DEST_SERVICE_KEY,
              'Authorization': `Bearer ${DEST_SERVICE_KEY}`
            },
            body: JSON.stringify({ sql_text: sql })
          })
          
          if (!response.ok) {
            console.log(`⚠️  Could not execute: ${sql.substring(0, 50)}...`)
            console.log(`   Error: ${await response.text()}`)
          } else {
            console.log(`✅ Executed: ${sql.substring(0, 50)}...`)
          }
        } else {
          console.log(`✅ Executed: ${sql.substring(0, 50)}...`)
        }
      } catch (err) {
        console.log(`⚠️  Error executing SQL: ${err.message}`)
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('\n💡 If RLS policies couldn\'t be updated automatically,')
    console.log('   please run the SQL from scripts/admin-schema.sql')
    console.log('   in your Supabase SQL Editor.\n')

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error)
  }
}

// Also create a simpler policy that allows users to read their own profile
async function createSimplePolicy() {
  try {
    console.log('\n🔧 Creating simple RLS policy (alternative approach)\n')
    
    // Grant access to authenticated users to read their own profile
    const grantSQL = `
      -- Allow authenticated users to read their own profile
      GRANT SELECT ON user_profiles TO authenticated;
      
      -- Ensure the table has RLS enabled
      ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
    `
    
    console.log('SQL to run manually in Supabase SQL Editor:')
    console.log(grantSQL)
    console.log('\n')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

async function main() {
  await fixRLS()
  await createSimplePolicy()
}

main()


