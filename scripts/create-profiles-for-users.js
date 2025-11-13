const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env.local') })

// Use destination credentials directly
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fzorirzobvypsachtwkx.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6b3JpcnpvYnZ5cHNhY2h0d2t4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk1ODM4NCwiZXhwIjoyMDc4NTM0Mzg0fQ.k0GX7-GARsz80MdyBxw5alASDd7W9_aWdPANXuJQgN8'

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Error: Missing Supabase credentials!')
  process.exit(1)
}

console.log(`📌 Using Supabase: ${supabaseUrl}`)

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createProfilesForUsers() {
  try {
    console.log('\n🔐 Create Profiles for Auth Users\n')
    console.log('='.repeat(60))

    // Get all users from auth
    console.log('\n📝 Step 1: Fetching users from auth...')
    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers()
    
    if (listError) {
      console.error('❌ Error listing users:', listError.message)
      console.error('   Code:', listError.code)
      console.error('   Full error:', JSON.stringify(listError, null, 2))
      process.exit(1)
    }

    console.log('Debug - usersData:', JSON.stringify(usersData, null, 2))

    const users = usersData?.users || []
    
    if (users.length === 0) {
      console.error('❌ No users found in auth!')
      console.log('   This might mean:')
      console.log('   1. The users are in a different Supabase project')
      console.log('   2. The service role key doesn\'t have permission')
      console.log('   3. There are actually no users')
      process.exit(1)
    }

    console.log(`✅ Found ${users.length} user(s) in auth`)

    // Check existing profiles
    console.log('\n📝 Step 2: Checking existing profiles...')
    const { data: existingProfiles, error: profilesError } = await supabase
      .from('user_profiles')
      .select('id, email, role')

    if (profilesError && profilesError.code !== 'PGRST116') {
      console.error('❌ Error fetching profiles:', profilesError.message)
      process.exit(1)
    }

    const existingProfileIds = new Set((existingProfiles || []).map(p => p.id))
    console.log(`✅ Found ${existingProfiles?.length || 0} existing profile(s)`)

    // Process each user
    console.log('\n📝 Step 3: Creating/updating profiles...')
    console.log('='.repeat(60))

    let created = 0
    let updated = 0
    let skipped = 0

    for (const user of usersData.users) {
      console.log(`\n👤 Processing: ${user.email}`)
      console.log(`   User ID: ${user.id}`)

      const hasProfile = existingProfileIds.has(user.id)

      if (hasProfile) {
        // Update existing profile to admin
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({
            role: 'admin',
            email: user.email
          })
          .eq('id', user.id)

        if (updateError) {
          console.error(`   ❌ Error updating profile: ${updateError.message}`)
          skipped++
        } else {
          console.log(`   ✅ Profile updated to admin role`)
          updated++
        }
      } else {
        // Create new profile
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            id: user.id,
            email: user.email,
            role: 'admin'
          })

        if (insertError) {
          console.error(`   ❌ Error creating profile: ${insertError.message}`)
          console.error(`   Code: ${insertError.code}`)
          console.error(`   Details: ${insertError.details}`)
          console.log(`   ⚠️  Manual SQL:`)
          console.log(`   INSERT INTO user_profiles (id, email, role) VALUES ('${user.id}', '${user.email}', 'admin');`)
          skipped++
        } else {
          console.log(`   ✅ Profile created with admin role`)
          created++
        }
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('\n📊 Summary:')
    console.log(`   ✅ Created: ${created}`)
    console.log(`   ✅ Updated: ${updated}`)
    console.log(`   ⚠️  Skipped: ${skipped}`)
    console.log('\n✅ Process complete!')
    console.log('\n📝 Users can now login at: http://localhost:3000/admin/login\n')

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error)
    process.exit(1)
  }
}

createProfilesForUsers()

