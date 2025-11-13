const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env.local') })

// Support both source and destination credentials
// Can be overridden with command line args: --source or --dest
const args = process.argv.slice(2)
const useSource = args.includes('--source')
const useDest = args.includes('--dest')

let supabaseUrl, serviceRoleKey

if (useSource) {
  // Source Supabase (Credentials 1)
  supabaseUrl = 'https://sejgcgatlggiznkcimvz.supabase.co'
  serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlamdjZ2F0bGdnaXpua2NpbXZ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYzMjg5OCwiZXhwIjoyMDc4MjA4ODk4fQ.4qS1aIp3ynSxk8b-TWx4EELKzNeWHa5Abfcec3CnbHM'
  console.log('📌 Using SOURCE Supabase (Credentials 1)')
} else if (useDest) {
  // Destination Supabase (Credentials 2)
  supabaseUrl = 'https://fzorirzobvypsachtwkx.supabase.co'
  serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6b3JpcnpvYnZ5cHNhY2h0d2t4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk1ODM4NCwiZXhwIjoyMDc4NTM0Mzg0fQ.k0GX7-GARsz80MdyBxw5alASDd7W9_aWdPANXuJQgN8'
  console.log('📌 Using DESTINATION Supabase (Credentials 2)')
} else {
  // Use .env.local
  supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
}

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Error: Missing Supabase credentials!')
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local')
  console.error('Or use --source or --dest flags to use predefined credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function updateAdminPassword() {
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  })

  const question = (query) => new Promise(resolve => readline.question(query, resolve))

  try {
    console.log('\n🔐 Update Admin Password\n')
    console.log('='.repeat(60))

    const email = await question('Admin email: ')
    const newPassword = await question('New password (min 6 characters): ')

    if (!email || !newPassword) {
      console.error('❌ Email and password are required!')
      process.exit(1)
    }

    if (newPassword.length < 6) {
      console.error('❌ Password must be at least 6 characters!')
      process.exit(1)
    }

    console.log('\n📝 Updating password...')

    // First, find the user by email
    const { data: users, error: listError } = await supabase.auth.admin.listUsers()
    
    if (listError) {
      console.error('❌ Error listing users:', listError.message)
      process.exit(1)
    }

    const user = users.users.find(u => u.email === email)
    
    if (!user) {
      console.error(`❌ User with email ${email} not found!`)
      process.exit(1)
    }

    // Verify user is admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      console.error(`❌ User ${email} is not an admin!`)
      process.exit(1)
    }

    // Update password using Admin API
    const { data, error } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        password: newPassword
      }
    )

    if (error) {
      console.error('❌ Error updating password:', error.message)
      process.exit(1)
    }

    console.log('\n' + '='.repeat(60))
    console.log('\n✅ Admin password updated successfully!')
    console.log(`   Email: ${email}`)
    console.log(`   User ID: ${user.id}`)
    console.log('\n📝 The admin can now login with the new password\n')

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    readline.close()
  }
}

// Filter out flags from args
const passwordArgs = args.filter(arg => !arg.startsWith('--'))

async function updatePasswordDirectly(email, password) {
  try {
    console.log('\n🔐 Updating Admin Password\n')
    console.log('='.repeat(60))

    // Find user by email or find first admin if email not provided
    const { data: users, error: listError } = await supabase.auth.admin.listUsers()
    
    if (listError) {
      console.error('❌ Error listing users:', listError.message)
      process.exit(1)
    }

    if (users.users.length === 0) {
      console.error('❌ No users found in the database!')
      console.log('\n💡 You may need to create an admin user first.')
      console.log('   Run: yarn admin:create-user\n')
      process.exit(1)
    }

    let user = null
    let adminEmail = email

    if (email) {
      // Find by email
      user = users.users.find(u => u.email === email)
      if (!user) {
        console.error(`❌ User with email ${email} not found!`)
        console.log('\n📋 Available users:')
        users.users.forEach(u => console.log(`   - ${u.email}`))
        process.exit(1)
      }
    } else {
      // Find first admin user
      console.log('🔍 Searching for admin users...\n')
      const adminUsers = []
      
      for (const u of users.users) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role, email')
          .eq('id', u.id)
          .single()
        
        if (profile && profile.role === 'admin') {
          adminUsers.push({ user: u, email: profile.email || u.email })
        }
      }
      
      if (adminUsers.length === 0) {
        console.error('❌ No admin user found!')
        console.log('\n📋 Available users:')
        users.users.forEach(u => {
          console.log(`   - ${u.email}`)
        })
        console.log('\n💡 You may need to:')
        console.log('   1. Create an admin user: yarn admin:create-user')
        console.log('   2. Or update a user to admin role in user_profiles table\n')
        process.exit(1)
      }
      
      if (adminUsers.length === 1) {
        user = adminUsers[0].user
        adminEmail = adminUsers[0].email
        console.log(`✅ Found admin user: ${adminEmail}`)
      } else {
        console.log('📋 Multiple admin users found:')
        adminUsers.forEach((admin, index) => {
          console.log(`   ${index + 1}. ${admin.email}`)
        })
        console.log('\n⚠️  Please specify the email:')
        console.log(`   yarn admin:update-password --dest <email> <password>`)
        process.exit(1)
      }
    }

    // Verify user is admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      console.error(`❌ User ${adminEmail} is not an admin!`)
      process.exit(1)
    }

    console.log(`Updating password for: ${adminEmail}`)
    console.log('='.repeat(60))

    // Update password
    const { data, error } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        password: password
      }
    )

    if (error) {
      console.error('❌ Error updating password:', error.message)
      process.exit(1)
    }

    console.log('\n✅ Admin password updated successfully!')
    console.log(`   Email: ${adminEmail}`)
    console.log(`   User ID: ${user.id}`)
    console.log(`   New Password: ${password}\n`)

  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

if (passwordArgs.length >= 2) {
  // Email and password provided
  const email = passwordArgs[0]
  const password = passwordArgs[1]
  updatePasswordDirectly(email, password)
} else if (passwordArgs.length === 1) {
  // Only password provided, find first admin
  const password = passwordArgs[0]
  updatePasswordDirectly(null, password)
} else {
  // Interactive mode
  updateAdminPassword()
}

