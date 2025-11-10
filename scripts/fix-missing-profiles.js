const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Error: Missing Supabase credentials!')
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function fixMissingProfiles() {
  try {
    console.log('\n🔧 Fixing Missing User Profiles\n')
    console.log('='.repeat(60))

    // Get all users from auth
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers()

    if (usersError) {
      console.error('❌ Error fetching users:', usersError.message)
      process.exit(1)
    }

    if (!users || users.length === 0) {
      console.log('ℹ️  No users found in auth')
      return
    }

    console.log(`📊 Found ${users.length} users in auth\n`)

    let created = 0
    let updated = 0
    let skipped = 0

    for (const user of users) {
      // Check if profile exists
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError && profileError.code !== 'PGRST116') {
        // PGRST116 is "not found" error, which is expected
        console.error(`⚠️  Error checking profile for ${user.email}:`, profileError.message)
        continue
      }

      if (profile) {
        // Profile exists, check if email matches
        let needsUpdate = false
        if (profile.email !== user.email) {
          const { error: updateError } = await supabase
            .from('user_profiles')
            .update({ email: user.email })
            .eq('id', user.id)

          if (updateError) {
            console.error(`⚠️  Error updating email for ${user.email}:`, updateError.message)
          } else {
            console.log(`✅ Updated email for profile: ${user.email}`)
            updated++
            needsUpdate = true
          }
        }
        
        if (!needsUpdate) {
          console.log(`ℹ️  Profile exists for ${user.email} (role: ${profile.role})`)
          skipped++
        }
      } else {
        // Profile doesn't exist, create it
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            id: user.id,
            email: user.email,
            role: 'user', // Default role, can be updated later
          })

        if (insertError) {
          console.error(`❌ Error creating profile for ${user.email}:`, insertError.message)
        } else {
          console.log(`✅ Created profile for: ${user.email}`)
          created++
        }
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('\n📊 Summary:')
    console.log(`   Created: ${created}`)
    console.log(`   Updated: ${updated}`)
    console.log(`   Skipped: ${skipped}`)
    console.log('\n✅ Done!\n')

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

fixMissingProfiles()

