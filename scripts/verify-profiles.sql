-- Verify profiles were created
-- Run this in Supabase SQL Editor

-- Check all profiles
SELECT id, email, role, created_at 
FROM user_profiles 
ORDER BY created_at DESC;

-- Check profiles for specific emails
SELECT up.id, up.email, up.role, au.email as auth_email
FROM user_profiles up
JOIN auth.users au ON up.id = au.id
WHERE up.email IN ('admin@gmail.com', 'admin@example.com');

-- Count profiles
SELECT COUNT(*) as total_profiles FROM user_profiles;

-- Count admin profiles
SELECT COUNT(*) as admin_profiles FROM user_profiles WHERE role = 'admin';

