const { createClient } = require('@supabase/supabase-js')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../.env.local') })

// Use destination credentials directly
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://fzorirzobvypsachtwkx.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6b3JpcnpvYnZ5cHNhY2h0d2t4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk1ODM4NCwiZXhwIjoyMDc4NTM0Mzg0fQ.k0GX7-GARsz80MdyBxw5alASDd7W9_aWdPANXuJQgN8'

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function deleteAllUsers() {
  try {
    console.log('\n🗑️  Delete All Users\n')
    console.log('='.repeat(60))

    // Step 1: Get all users from auth
    console.log('\n📝 Step 1: Fetching users from auth...')
    
    // Use SQL to get users since API might not work
    const getUsersSQL = `
      SELECT id, email FROM auth.users;
    `

    let userIds = []
    let userEmails = []

    try {
      const { data: usersData, error: listError } = await supabase.auth.admin.listUsers()
      if (!listError && usersData?.users) {
        userIds = usersData.users.map(u => u.id)
        userEmails = usersData.users.map(u => u.email)
        console.log(`✅ Found ${userIds.length} user(s) via API`)
        usersData.users.forEach(u => {
          console.log(`   - ${u.email} (${u.id})`)
        })
      }
    } catch (err) {
      console.log('⚠️  Could not fetch users via API, using SQL method...')
    }

    // If no users found via API, use SQL
    if (userIds.length === 0) {
      console.log('\n📝 Using SQL to get users...')
      const deleteSQL = `
        -- Delete all profiles first (to avoid foreign key constraint)
        DELETE FROM user_profiles;
        
        -- Delete all users from auth
        DELETE FROM auth.users;
      `
      
      console.log('\n⚠️  SQL to delete all users:')
      console.log('='.repeat(60))
      console.log(deleteSQL)
      console.log('='.repeat(60))
      console.log('\n💡 Run this SQL in Supabase SQL Editor:')
      console.log('   https://app.supabase.com/project/fzorirzobvypsachtwkx/sql\n')
      
      // Try to execute
      try {
        const { error: sqlError } = await supabase.rpc('exec_sql', { sql_text: deleteSQL })
        if (sqlError) {
          console.log('⚠️  Could not execute via RPC, please run SQL manually\n')
        } else {
          console.log('✅ All users and profiles deleted!\n')
        }
      } catch (err) {
        console.log('⚠️  Could not execute via RPC, please run SQL manually\n')
      }
      return
    }

    // Step 2: Delete profiles first
    console.log('\n📝 Step 2: Deleting profiles...')
    for (const userId of userIds) {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', userId)

      if (profileError) {
        console.log(`   ⚠️  Could not delete profile for ${userId}: ${profileError.message}`)
      } else {
        console.log(`   ✅ Deleted profile for ${userEmails[userIds.indexOf(userId)]}`)
      }
    }

    // Step 3: Delete users from auth
    console.log('\n📝 Step 3: Deleting users from auth...')
    for (const userId of userIds) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(userId)
      
      if (deleteError) {
        console.log(`   ⚠️  Could not delete user ${userId}: ${deleteError.message}`)
      } else {
        console.log(`   ✅ Deleted user ${userEmails[userIds.indexOf(userId)]}`)
      }
    }

    console.log('\n' + '='.repeat(60))
    console.log('\n✅ Deletion complete!')
    console.log(`   Deleted ${userIds.length} user(s) and their profiles\n`)

  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error)
  }
}

deleteAllUsers()

