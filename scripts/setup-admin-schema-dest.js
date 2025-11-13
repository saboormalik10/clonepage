const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Destination Supabase (Credentials 2)
const DEST_URL = 'https://fzorirzobvypsachtwkx.supabase.co'
const DEST_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6b3JpcnpvYnZ5cHNhY2h0d2t4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk1ODM4NCwiZXhwIjoyMDc4NTM0Mzg0fQ.k0GX7-GARsz80MdyBxw5alASDd7W9_aWdPANXuJQgN8'

const supabase = createClient(DEST_URL, DEST_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function setupSchema() {
  try {
    console.log('\n🔧 Setting up Admin Schema in Destination Database\n')
    console.log('='.repeat(60))

    // Read the SQL file
    const sqlFile = path.join(__dirname, 'fix-user-profiles-rls-dest.sql')
    const sql = fs.readFileSync(sqlFile, 'utf8')

    console.log('\n📋 SQL file found: fix-user-profiles-rls-dest.sql')
    console.log('\n⚠️  IMPORTANT: Please run this SQL in your Supabase SQL Editor!')
    console.log(`   URL: https://app.supabase.com/project/fzorirzobvypsachtwkx/sql`)
    console.log('\n📄 SQL Content:')
    console.log('='.repeat(60))
    console.log(sql)
    console.log('='.repeat(60))
    console.log('\n💡 After running the SQL, you can create admin users with:')
    console.log('   yarn admin:create-user\n')

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

setupSchema()


