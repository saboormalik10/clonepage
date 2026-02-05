const { createClient } = require('@supabase/supabase-js');

const DEST_URL = 'https://fgptzilqznazirjlwydg.supabase.co';
const DEST_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZncHR6aWxxem5hemlyamx3eWRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIyNDAwOCwiZXhwIjoyMDg1ODAwMDA4fQ.rk5dsDM8XARdtYGuqTIRU0VazMvfeUj29UHQYSJNpNg';

const client = createClient(DEST_URL, DEST_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function createUserProfile() {
  const { data: users, error: listError } = await client.auth.admin.listUsers();
  
  if (listError) {
    console.log('Error:', listError.message);
    return;
  }
  
  const user = users.users.find(u => u.email === 'mb_2@outlook.com');
  
  if (!user) {
    console.log('User not found');
    return;
  }
  
  console.log('Found user:', user.id);
  
  // Insert profile
  const { data, error } = await client.from('user_profiles').upsert({
    id: user.id,
    email: 'mb_2@outlook.com',
    full_name: 'Test User',
    role: 'user'
  }, { onConflict: 'id' });
  
  if (error) {
    console.log('Error creating profile:', error.message);
  } else {
    console.log('✓ User profile created for mb_2@outlook.com');
  }
}

createUserProfile();
