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

async function replaceAdmin() {
  const oldEmail = 'admin@gmail.com'
  const newEmail = 'mb_2@outlook.com'
  const newPassword = 'Admin@1234' // Default password, user can change it later

  try {
    console.log('\n🔄 Replace Admin User\n')
    console.log('='.repeat(60))
    console.log(`Old Email: ${oldEmail}`)
    console.log(`New Email: ${newEmail}`)
    console.log(`New Password: ${newPassword}`)
    console.log('='.repeat(60))

    // Step 1: Find and delete old admin user
    console.log('\n📝 Step 1: Finding old admin user...')
    const { data: usersData, error: listError } = await supabase.auth.admin.listUsers()
    
    if (listError) {
      console.error('❌ Error listing users:', listError.message)
      process.exit(1)
    }

    const oldUser = usersData.users.find(u => u.email?.toLowerCase() === oldEmail.toLowerCase())
    
    if (oldUser) {
      console.log(`✅ Found old admin user: ${oldUser.email} (ID: ${oldUser.id})`)
      
      // Delete profile first
      console.log('\n📝 Step 2: Deleting old user profile...')
      const { error: profileError } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', oldUser.id)

      if (profileError) {
        console.log(`   ⚠️  Could not delete profile: ${profileError.message}`)
        console.log('   Continuing with user deletion...')
      } else {
        console.log('   ✅ Profile deleted')
      }

      // Delete user from auth
      console.log('\n📝 Step 3: Deleting old user from auth...')
      const { error: deleteError } = await supabase.auth.admin.deleteUser(oldUser.id)
      
      if (deleteError) {
        console.error('❌ Error deleting user:', deleteError.message)
        process.exit(1)
      }
      console.log('   ✅ Old admin user deleted')
    } else {
      console.log(`⚠️  Old admin user with email ${oldEmail} not found`)
      console.log('   Continuing to create new admin...')
    }

    // Step 4: Check if new email already exists
    console.log('\n📝 Step 4: Checking if new email already exists...')
    const existingUser = usersData.users.find(u => u.email?.toLowerCase() === newEmail.toLowerCase())
    
    if (existingUser) {
      console.log(`⚠️  User with email ${newEmail} already exists!`)
      console.log(`   User ID: ${existingUser.id}`)
      console.log('\n   Updating existing user to admin role...')
      
      // Update existing user to admin
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', existingUser.id)
        .single()

      if (existingProfile) {
        // Update profile
        const { error: profileError } = await supabase
          .from('user_profiles')
          .update({ role: 'admin' })
          .eq('id', existingUser.id)

        if (profileError) {
          console.error('❌ Error updating profile:', profileError.message)
          process.exit(1)
        }
        console.log('   ✅ Profile updated to admin role')
      } else {
        // Create profile
        const { error: profileError } = await supabase
          .from('user_profiles')
          .insert({
            id: existingUser.id,
            email: newEmail,
            role: 'admin',
          })

        if (profileError) {
          console.error('❌ Error creating profile:', profileError.message)
          process.exit(1)
        }
        console.log('   ✅ Profile created with admin role')
      }

      // Update password
      const { error: passwordError } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        { password: newPassword }
      )

      if (passwordError) {
        console.error('❌ Error updating password:', passwordError.message)
        process.exit(1)
      }
      console.log('   ✅ Password updated')

      console.log('\n' + '='.repeat(60))
      console.log('\n✅ Admin user updated successfully!')
      console.log(`   Email: ${newEmail}`)
      console.log(`   Password: ${newPassword}`)
      console.log(`   User ID: ${existingUser.id}`)
      console.log('\n📝 You can now login at: http://localhost:3000/admin/login\n')
      return
    }

    // Step 5: Create new admin user
    console.log('\n📝 Step 5: Creating new admin user...')
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: newEmail,
      password: newPassword,
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

    console.log('   ✅ User created in auth')

    // Step 6: Create profile with admin role
    console.log('\n📝 Step 6: Creating admin profile...')
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: authData.user.id,
        email: newEmail,
        role: 'admin',
      })

    if (profileError) {
      console.error('❌ Error creating profile:', profileError.message)
      console.log('⚠️  User was created but profile creation failed. You can manually create it:')
      console.log(`   INSERT INTO user_profiles (id, email, role) VALUES ('${authData.user.id}', '${newEmail}', 'admin');`)
      process.exit(1)
    }
    console.log('   ✅ Profile created with admin role')

    console.log('\n' + '='.repeat(60))
    console.log('\n✅ Admin user replaced successfully!')
    console.log(`   New Email: ${newEmail}`)
    console.log(`   Password: ${newPassword}`)
    console.log(`   User ID: ${authData.user.id}`)
    console.log('\n📝 You can now login at: http://localhost:3000/admin/login\n')

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error)
    process.exit(1)
  }
}

replaceAdmin()

