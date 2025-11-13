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

async function makeUserAdmin(email) {
  try {
    console.log('\n🔐 Make User Admin\n')
    console.log('='.repeat(60))
    console.log(`Email: ${email}`)
    console.log('='.repeat(60))

    // Find user by email
    console.log('\n📝 Finding user...')
    const { data: users, error: listError } = await supabase.auth.admin.listUsers()
    
    if (listError) {
      console.error('❌ Error listing users:', listError.message)
      process.exit(1)
    }

    const user = users.users.find(u => u.email === email)
    
    if (!user) {
      console.error(`❌ User with email ${email} not found!`)
      console.log('\n📋 Available users:')
      users.users.forEach(u => console.log(`   - ${u.email}`))
      console.log('\n💡 Create the user first in Supabase Dashboard:')
      console.log('   Authentication → Users → Add user')
      process.exit(1)
    }

    console.log(`✅ Found user: ${user.email}`)
    console.log(`   User ID: ${user.id}`)

    // Check if profile exists
    console.log('\n📝 Checking profile...')
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (existingProfile) {
      console.log('✅ Profile exists, updating to admin...')
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          role: 'admin'
        })
        .eq('id', user.id)

      if (updateError) {
        console.error('❌ Error updating profile:', updateError.message)
        console.log('\n⚠️  Manual SQL to fix:')
        console.log(`   UPDATE user_profiles SET role = 'admin' WHERE id = '${user.id}';`)
        process.exit(1)
      }
      console.log('✅ Profile updated to admin role')
    } else {
      console.log('📝 Creating profile with admin role...')
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: user.id,
          email: user.email,
          role: 'admin'
        })

      if (profileError) {
        console.error('❌ Error creating profile:', profileError.message)
        console.log('\n⚠️  Manual SQL to create profile:')
        console.log(`   INSERT INTO user_profiles (id, email, role) VALUES ('${user.id}', '${user.email}', 'admin');`)
        process.exit(1)
      }
      console.log('✅ Profile created with admin role')
    }

    console.log('\n' + '='.repeat(60))
    console.log('\n✅ User is now an admin!')
    console.log(`   Email: ${email}`)
    console.log(`   User ID: ${user.id}`)
    console.log('\n📝 You can now login at: http://localhost:3000/admin/login\n')

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error)
    process.exit(1)
  }
}

// Get email from command line
const email = process.argv[2]

if (!email) {
  console.error('❌ Usage: node make-user-admin.js <email>')
  console.error('   Example: node make-user-admin.js admin@gmail.com')
  process.exit(1)
}

makeUserAdmin(email)


