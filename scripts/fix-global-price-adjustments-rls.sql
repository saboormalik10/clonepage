-- Fix RLS policy for global_price_adjustments to allow public read access
-- Global adjustments should be readable by everyone since they affect all users' prices
-- Run this in your Supabase SQL Editor

-- Drop existing admin-only read policy
DROP POLICY IF EXISTS "Admins can view global adjustments" ON global_price_adjustments;

-- Create new policy: Everyone can read global adjustments (they're public information)
CREATE POLICY "Allow public read access" ON global_price_adjustments
  FOR SELECT USING (true);

-- Keep admin-only policies for write operations
-- (These should already exist, but we'll ensure they're there)

-- Policy: Admins can insert global adjustments
DROP POLICY IF EXISTS "Admins can insert global adjustments" ON global_price_adjustments;
CREATE POLICY "Admins can insert global adjustments" ON global_price_adjustments
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

-- Policy: Admins can update global adjustments
DROP POLICY IF EXISTS "Admins can update global adjustments" ON global_price_adjustments;
CREATE POLICY "Admins can update global adjustments" ON global_price_adjustments
  FOR UPDATE USING (public.is_admin(auth.uid()));

-- Policy: Admins can delete global adjustments
DROP POLICY IF EXISTS "Admins can delete global adjustments" ON global_price_adjustments;
CREATE POLICY "Admins can delete global adjustments" ON global_price_adjustments
  FOR DELETE USING (public.is_admin(auth.uid()));



