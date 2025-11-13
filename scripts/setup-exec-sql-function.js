const { createClient } = require('@supabase/supabase-js')

// Destination Supabase (Credentials 2)
const DEST_URL = 'https://fzorirzobvypsachtwkx.supabase.co'
const DEST_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6b3JpcnpvYnZ5cHNhY2h0d2t4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk1ODM4NCwiZXhwIjoyMDc4NTM0Mzg0fQ.k0GX7-GARsz80MdyBxw5alASDd7W9_aWdPANXuJQgN8'

const destClient = createClient(DEST_URL, DEST_SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
})

async function setupExecSqlFunction() {
  console.log('\n🚀 Setting up exec_sql function in destination database...\n')
  console.log('='.repeat(60))

  const createFunctionSQL = `
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

  console.log('\n📋 SQL to create exec_sql function:')
  console.log(createFunctionSQL)
  console.log('\n' + '='.repeat(60))
  console.log('\n⚠️  Please run the above SQL in your Supabase SQL Editor:')
  console.log(`   ${DEST_URL.replace('https://', 'https://app.supabase.com/project/')}/sql`)
  console.log('\n   Or use Supabase CLI: supabase db execute --file <sql-file>')
  console.log('\n   This function is required for automatic table creation.\n')
}

setupExecSqlFunction().catch(console.error)

