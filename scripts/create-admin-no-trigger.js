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
    console.log('\n🔐 Create Admin User (Bypassing Trigger)\n')
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

    console.log('\n📝 Step 1: Temporarily disabling trigger...')
    
    // Try to disable the trigger temporarily
    try {
      const disableTriggerSQL = `
        DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
      `
      
      // Try using REST API to execute SQL
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`
        },
        body: JSON.stringify({ sql_text: disableTriggerSQL })
      })
      
      if (response.ok) {
        console.log('✅ Trigger disabled temporarily')
      } else {
        console.log('⚠️  Could not disable trigger automatically (may not exist)')
      }
    } catch (err) {
      console.log('⚠️  Could not disable trigger (will try to create profile manually)')
    }

    console.log('\n📝 Step 2: Creating user in auth...')

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

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000))

    console.log('\n📝 Step 3: Creating profile manually...')

    // Create profile manually using service role (bypasses RLS)
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
      
      // Check if profile already exists
      const { data: existingProfile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', authData.user.id)
        .single()

      if (existingProfile) {
        console.log('\n✅ Profile already exists, updating to admin...')
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
        console.log('\n⚠️  Manual SQL to create profile:')
        console.log(`   INSERT INTO user_profiles (id, email, role, full_name) VALUES ('${authData.user.id}', '${email}', 'admin', ${fullName ? `'${fullName}'` : 'NULL'});`)
        process.exit(1)
      }
    } else {
      console.log('✅ Profile created with admin role')
    }

    // Re-enable trigger
    console.log('\n📝 Step 4: Re-enabling trigger...')
    try {
      const enableTriggerSQL = `
        CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
      `
      
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`
        },
        body: JSON.stringify({ sql_text: enableTriggerSQL })
      })
      
      if (response.ok) {
        console.log('✅ Trigger re-enabled')
      } else {
        console.log('⚠️  Could not re-enable trigger (you may need to do this manually)')
      }
    } catch (err) {
      console.log('⚠️  Could not re-enable trigger')
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


