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

async function createAdminUser() {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  })

  const question = (query) => new Promise(resolve => readline.question(query, resolve))

  try {
    console.log('\n🔐 Create Admin User\n')
    console.log('='.repeat(60))

    const email = await question('Email: ')
    const password = await question('Password (min 6 characters): ')
    const fullName = await question('Full Name (optional): ')

    if (!email || !password) {
      console.error('❌ Email and password are required!')
      process.exit(1)
    }

    if (password.length < 6) {
      console.error('❌ Password must be at least 6 characters!')
      process.exit(1)
    }

    console.log('\n📝 Creating user...')

    // First, check if user_profiles table exists
    const { error: tableCheckError } = await supabase
      .from('user_profiles')
      .select('id')
      .limit(1)

    if (tableCheckError) {
      console.error('❌ Error: user_profiles table does not exist or is not accessible!')
      console.error('   Please run the admin schema SQL first:')
      console.error('   scripts/admin-schema.sql or scripts/fix-user-profiles-rls-dest.sql')
      console.error('\n   Or run in Supabase SQL Editor:')
      console.error('   CREATE TABLE IF NOT EXISTS user_profiles (')
      console.error('     id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,')
      console.error('     email TEXT NOT NULL,')
      console.error('     full_name TEXT,')
      console.error('     role TEXT NOT NULL DEFAULT \'user\' CHECK (role IN (\'admin\', \'user\')),')
      console.error('     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),')
      console.error('     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),')
      console.error('     UNIQUE(email)')
      console.error('   );')
      process.exit(1)
    }

    // Create user in auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      console.error('❌ Error creating user:', authError.message)
      if (authError.message.includes('already registered')) {
        console.log('\n💡 User already exists. You can update the password with:')
        console.log(`   yarn admin:update-password ${email} ${password}`)
      }
      process.exit(1)
    }

    if (!authData.user) {
      console.error('❌ Failed to create user')
      process.exit(1)
    }

    console.log('✅ User created in auth')
    console.log(`   User ID: ${authData.user.id}`)

    // Wait a moment for trigger to potentially create profile
    await new Promise(resolve => setTimeout(resolve, 500))

    // Check if profile exists (might have been created by trigger)
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('user_profiles')
      .select('id, role')
      .eq('id', authData.user.id)
      .single()

    if (existingProfile) {
      // Profile exists (created by trigger or already exists)
      console.log('✅ Profile found (created by trigger)')
      
      // Update it to admin role
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          role: 'admin',
          full_name: fullName || null,
        })
        .eq('id', authData.user.id)

      if (profileError) {
        console.error('❌ Error updating profile:', profileError.message)
        console.log('⚠️  User was created but profile update failed. You can manually update it:')
        console.log(`   UPDATE user_profiles SET role = 'admin' WHERE id = '${authData.user.id}';`)
        process.exit(1)
      }
      console.log('✅ Profile updated to admin role')
    } else {
      // Profile doesn't exist, create it manually
      console.log('📝 Creating profile manually (trigger may not have fired)...')
      
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
        console.log('⚠️  User was created but profile creation failed. You can manually create it:')
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
  } finally {
    readline.close()
  }
}

createAdminUser()


