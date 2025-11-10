-- Fix RLS policies for user_profiles to avoid infinite recursion
-- Run this in your Supabase SQL Editor

-- ============================================
-- STEP 1: Drop existing problematic policies
-- ============================================

DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON user_profiles;

-- ============================================
-- STEP 2: Create a helper function to check if user is admin
-- This function uses SECURITY DEFINER to bypass RLS
-- ============================================

CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = user_id AND role = 'admin'
  );
END;
$$;

-- ============================================
-- STEP 3: Create new RLS policies without recursion
-- ============================================

-- Policy: Users can read their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Policy: Admins can view all profiles (using the helper function)
CREATE POLICY "Admins can view all profiles" ON user_profiles
  FOR SELECT USING (public.is_admin(auth.uid()));

-- Policy: Admins can insert profiles
CREATE POLICY "Admins can insert profiles" ON user_profiles
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

-- Policy: Admins can update profiles
CREATE POLICY "Admins can update profiles" ON user_profiles
  FOR UPDATE USING (public.is_admin(auth.uid()));

-- Policy: Admins can delete profiles
CREATE POLICY "Admins can delete profiles" ON user_profiles
  FOR DELETE USING (public.is_admin(auth.uid()));

-- ============================================
-- STEP 4: Grant execute permission on the function
-- ============================================

GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO anon;


