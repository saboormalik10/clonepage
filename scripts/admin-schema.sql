-- Admin Panel Database Schema
-- Run this in your Supabase SQL Editor

-- ============================================
-- USERS TABLE (extends Supabase auth.users)
-- ============================================

-- Create profiles table to store additional user information
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(email)
);

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin (avoids infinite recursion)
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

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO anon;

-- Policy: Users can read their own profile
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Policy: Admins can view all profiles (using helper function to avoid recursion)
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
-- USER PRICE ADJUSTMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS user_price_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL CHECK (table_name IN (
    'publications', 'social_posts', 'digital_tv', 'best_sellers', 
    'listicles', 'pr_bundles', 'print', 'broadcast_tv'
  )),
  adjustment_percentage NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, table_name)
);

-- Enable RLS
ALTER TABLE user_price_adjustments ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own adjustments
CREATE POLICY "Users can view own adjustments" ON user_price_adjustments
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Admins can view all adjustments
CREATE POLICY "Admins can view all adjustments" ON user_price_adjustments
  FOR SELECT USING (public.is_admin(auth.uid()));

-- Policy: Admins can insert adjustments
CREATE POLICY "Admins can insert adjustments" ON user_price_adjustments
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

-- Policy: Admins can update adjustments
CREATE POLICY "Admins can update adjustments" ON user_price_adjustments
  FOR UPDATE USING (public.is_admin(auth.uid()));

-- Policy: Admins can delete adjustments
CREATE POLICY "Admins can delete adjustments" ON user_price_adjustments
  FOR DELETE USING (public.is_admin(auth.uid()));

-- ============================================
-- GLOBAL PRICE ADJUSTMENTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS global_price_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL CHECK (table_name IN (
    'publications', 'social_posts', 'digital_tv', 'best_sellers', 
    'listicles', 'pr_bundles', 'print', 'broadcast_tv'
  )),
  adjustment_percentage NUMERIC NOT NULL,
  applied_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(table_name)
);

-- Enable RLS
ALTER TABLE global_price_adjustments ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read global adjustments (they affect all users' prices)
CREATE POLICY "Allow public read access" ON global_price_adjustments
  FOR SELECT USING (true);

-- Policy: Admins can insert global adjustments
CREATE POLICY "Admins can insert global adjustments" ON global_price_adjustments
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

-- Policy: Admins can update global adjustments
CREATE POLICY "Admins can update global adjustments" ON global_price_adjustments
  FOR UPDATE USING (public.is_admin(auth.uid()));

-- Policy: Admins can delete global adjustments
CREATE POLICY "Admins can delete global adjustments" ON global_price_adjustments
  FOR DELETE USING (public.is_admin(auth.uid()));

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to automatically create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_price_adjustments_updated_at
  BEFORE UPDATE ON user_price_adjustments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_global_price_adjustments_updated_at
  BEFORE UPDATE ON global_price_adjustments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


