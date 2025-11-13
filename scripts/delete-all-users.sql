-- Delete all users and profiles
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/fzorirzobvypsachtwkx/sql

-- Step 1: Delete all profiles first (to avoid foreign key constraint issues)
DELETE FROM user_profiles;

-- Step 2: Delete all users from auth
DELETE FROM auth.users;

-- Verify deletion
SELECT COUNT(*) as remaining_profiles FROM user_profiles;
SELECT COUNT(*) as remaining_users FROM auth.users;

