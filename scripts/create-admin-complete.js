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

// Execute SQL via REST API
async function executeSQL(sql) {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      },
      body: JSON.stringify({ sql_text: sql })
    })
    return { ok: response.ok, error: response.ok ? null : await response.text() }
  } catch (error) {
    return { ok: false, error: error.message }
  }
}

async function createAdminUser(email, password, fullName) {
  try {
    console.log('\n🔐 Create Admin User (Complete Solution)\n')
    console.log('='.repeat(60))
    console.log(`Email: ${email}`)
    console.log(`Password: ${password}`)
    console.log(`Full Name: ${fullName || 'N/A'}`)
    console.log('='.repeat(60))

    // Step 1: Disable trigger
    console.log('\n📝 Step 1: Disabling trigger...')
    const disableResult = await executeSQL('DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;')
    if (disableResult.ok) {
      console.log('✅ Trigger disabled')
    } else {
      console.log('⚠️  Could not disable trigger (may not exist):', disableResult.error)
    }

    // Step 2: Create user in auth
    console.log('\n📝 Step 2: Creating user in auth...')
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      console.error('❌ Error creating user:', authError.message)
      
      // Check if user already exists
      if (authError.message.includes('already registered') || authError.message.includes('already exists')) {
        console.log('\n💡 User already exists. Fetching user...')
        const { data: users } = await supabase.auth.admin.listUsers()
        const existingUser = users.users.find(u => u.email === email)
        
        if (existingUser) {
          console.log('✅ Found existing user')
          // Update password
          const { error: updateError } = await supabase.auth.admin.updateUserById(
            existingUser.id,
            { password }
          )
          if (updateError) {
            console.error('❌ Error updating password:', updateError.message)
          } else {
            console.log('✅ Password updated')
          }
          authData = { user: existingUser }
        } else {
          process.exit(1)
        }
      } else {
        process.exit(1)
      }
    }

    if (!authData || !authData.user) {
      console.error('❌ Failed to get user data')
      process.exit(1)
    }

    console.log('✅ User created/updated in auth')
    console.log(`   User ID: ${authData.user.id}`)

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Step 3: Create profile manually
    console.log('\n📝 Step 3: Creating profile...')
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: authData.user.id,
        email: email,
        role: 'admin',
        full_name: fullName || null,
      })

    if (profileError) {
      // Check if profile already exists
      if (profileError.code === '23505') { // Unique violation
        console.log('⚠️  Profile already exists, updating...')
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({
            role: 'admin',
            full_name: fullName || null,
          })
          .eq('id', authData.user.id)

        if (updateError) {
          console.error('❌ Error updating profile:', updateError.message)
          console.log('\n⚠️  Manual SQL to fix:')
          console.log(`   UPDATE user_profiles SET role = 'admin' WHERE id = '${authData.user.id}';`)
          process.exit(1)
        }
        console.log('✅ Profile updated to admin role')
      } else {
        console.error('❌ Error creating profile:', profileError.message)
        console.error('   Code:', profileError.code)
        console.log('\n⚠️  Manual SQL to create profile:')
        console.log(`   INSERT INTO user_profiles (id, email, role, full_name) VALUES ('${authData.user.id}', '${email}', 'admin', ${fullName ? `'${fullName}'` : 'NULL'});`)
        process.exit(1)
      }
    } else {
      console.log('✅ Profile created with admin role')
    }

    // Step 4: Re-enable trigger
    console.log('\n📝 Step 4: Re-enabling trigger...')
    const enableSQL = `
      CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    `
    const enableResult = await executeSQL(enableSQL)
    if (enableResult.ok) {
      console.log('✅ Trigger re-enabled')
    } else {
      console.log('⚠️  Could not re-enable trigger:', enableResult.error)
      console.log('   You may need to run this SQL manually:')
      console.log(enableSQL)
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
  console.error('❌ Usage: node create-admin-complete.js <email> <password> [fullName]')
  console.error('   Example: node create-admin-complete.js admin@gmail.com admin@1234 "Admin User"')
  process.exit(1)
}

if (password.length < 6) {
  console.error('❌ Password must be at least 6 characters!')
  process.exit(1)
}

createAdminUser(email, password, fullName)


