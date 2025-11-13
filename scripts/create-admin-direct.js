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

async function createAdminUser(email, password, fullName) {
  try {
    console.log('\n🔐 Create Admin User\n')
    console.log('='.repeat(60))
    console.log(`Email: ${email}`)
    console.log(`Password: ${password}`)
    console.log(`Full Name: ${fullName || 'N/A'}`)
    console.log('='.repeat(60))

    console.log('\n📝 Step 1: Creating user in auth...')

    // Create user in auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      console.error('❌ Error creating user:', authError.message)
      if (authError.message.includes('already registered')) {
        console.log('\n💡 User already exists. Updating password...')
        // Get existing user
        const { data: users } = await supabase.auth.admin.listUsers()
        const existingUser = users.users.find(u => u.email === email)
        if (existingUser) {
          const { error: updateError } = await supabase.auth.admin.updateUserById(
            existingUser.id,
            { password }
          )
          if (updateError) {
            console.error('❌ Error updating password:', updateError.message)
            process.exit(1)
          }
          console.log('✅ Password updated')
          // Continue to create/update profile
          authData = { user: existingUser }
        } else {
          process.exit(1)
        }
      } else {
        process.exit(1)
      }
    }

    if (!authData || !authData.user) {
      console.error('❌ Failed to create user')
      process.exit(1)
    }

    console.log('✅ User created/updated in auth')
    console.log(`   User ID: ${authData.user.id}`)

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000))

    console.log('\n📝 Step 2: Creating/updating profile...')

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single()

    if (existingProfile) {
      console.log('✅ Profile exists, updating to admin...')
      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({
          role: 'admin',
          full_name: fullName || null,
        })
        .eq('id', authData.user.id)

      if (updateError) {
        console.error('❌ Error updating profile:', updateError.message)
        console.error('   Code:', updateError.code)
        console.error('   Details:', updateError.details)
        console.log('\n⚠️  Manual SQL to fix:')
        console.log(`   UPDATE user_profiles SET role = 'admin' WHERE id = '${authData.user.id}';`)
        process.exit(1)
      }
      console.log('✅ Profile updated to admin role')
    } else {
      console.log('📝 Creating new profile...')
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: authData.user.id,
          email: email,
          role: 'admin',
          full_name: fullName || null,
        })

      if (profileError) {
        console.error('❌ Error creating profile:', profileError.message)
        console.error('   Code:', profileError.code)
        console.error('   Details:', profileError.details)
        console.error('   Hint:', profileError.hint)
        console.log('\n⚠️  Manual SQL to create profile:')
        console.log(`   INSERT INTO user_profiles (id, email, role, full_name) VALUES ('${authData.user.id}', '${email}', 'admin', ${fullName ? `'${fullName}'` : 'NULL'});`)
        process.exit(1)
      }
      console.log('✅ Profile created with admin role')
    }

    console.log('\n' + '='.repeat(60))
    console.log('\n✅ Admin user created successfully!')
    console.log(`   Email: ${email}`)
    console.log(`   Password: ${password}`)
    console.log(`   User ID: ${authData.user.id}`)
    console.log('\n📝 You can now login at: http://localhost:3000/admin/login\n')

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error)
    process.exit(1)
  }
}

// Get command line arguments
const args = process.argv.slice(2)
const email = args[0]
const password = args[1]
const fullName = args[2]

if (!email || !password) {
  console.error('❌ Usage: node create-admin-direct.js <email> <password> [fullName]')
  console.error('   Example: node create-admin-direct.js admin@gmail.com admin@1234 "Admin User"')
  process.exit(1)
}

if (password.length < 6) {
  console.error('❌ Password must be at least 6 characters!')
  process.exit(1)
}

createAdminUser(email, password, fullName)


