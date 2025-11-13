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

async function createAdmin() {
  const args = process.argv.slice(2)
  const email = args[0] || 'admin@example.com'
  const password = args[1] || 'admin@1234'

  try {
    console.log('\n🔐 Creating Admin User in Destination Database\n')
    console.log('='.repeat(60))
    console.log(`Email: ${email}`)
    console.log(`Password: ${password}`)
    console.log('='.repeat(60))
    console.log('\n📝 Creating user...')

    // Create user in auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      console.error('❌ Error creating user:', authError.message)
      process.exit(1)
    }

    if (!authData.user) {
      console.error('❌ Failed to create user')
      process.exit(1)
    }

    console.log('✅ User created in auth')

    // Check if profile exists, if not create it, otherwise update it
    const { data: existingProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', authData.user.id)
      .single()

    if (existingProfile) {
      // Profile exists, update it
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          role: 'admin',
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
      // Profile doesn't exist, create it
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: authData.user.id,
          email: email,
          role: 'admin',
        })

      if (profileError) {
        console.error('❌ Error creating profile:', profileError.message)
        console.log('⚠️  User was created but profile creation failed. You can manually create it:')
        console.log(`   INSERT INTO user_profiles (id, email, role) VALUES ('${authData.user.id}', '${email}', 'admin');`)
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

createAdmin()


