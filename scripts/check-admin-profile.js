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

async function checkProfile() {
  try {
    console.log('\n🔍 Checking Admin Profile\n')
    console.log('='.repeat(60))

    // List all users
    const { data: users, error: listError } = await supabase.auth.admin.listUsers()
    
    if (listError) {
      console.error('❌ Error listing users:', listError.message)
      process.exit(1)
    }

    console.log(`\n📋 Found ${users.users.length} user(s):\n`)

    for (const user of users.users) {
      console.log(`User: ${user.email}`)
      console.log(`  ID: ${user.id}`)
      
      // Check profile with service role (bypasses RLS)
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError) {
        console.log(`  ❌ Profile Error: ${profileError.message}`)
        console.log(`  ❌ Code: ${profileError.code}`)
        
        if (profileError.code === 'PGRST116') {
          console.log(`  ⚠️  Profile does not exist! Creating...`)
          
          // Create profile
          const { error: createError } = await supabase
            .from('user_profiles')
            .insert({
              id: user.id,
              email: user.email,
              role: 'admin'
            })

          if (createError) {
            console.log(`  ❌ Failed to create profile: ${createError.message}`)
          } else {
            console.log(`  ✅ Profile created successfully!`)
          }
        }
      } else if (profile) {
        console.log(`  ✅ Profile exists:`)
        console.log(`     - Email: ${profile.email}`)
        console.log(`     - Role: ${profile.role}`)
        console.log(`     - Full Name: ${profile.full_name || 'N/A'}`)
        console.log(`     - Created: ${profile.created_at}`)
      }
      
      console.log('')
    }

    console.log('='.repeat(60))
    console.log('\n✅ Check complete!\n')

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error)
    process.exit(1)
  }
}

checkProfile()


