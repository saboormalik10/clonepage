-- Allow users to manage their own price adjustments
-- Run this in your Supabase SQL Editor

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can insert own adjustments" ON user_price_adjustments;
DROP POLICY IF EXISTS "Users can update own adjustments" ON user_price_adjustments;
DROP POLICY IF EXISTS "Users can delete own adjustments" ON user_price_adjustments;

-- Policy: Users can insert their own adjustments
CREATE POLICY "Users can insert own adjustments" ON user_price_adjustments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own adjustments
CREATE POLICY "Users can update own adjustments" ON user_price_adjustments
  FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own adjustments
CREATE POLICY "Users can delete own adjustments" ON user_price_adjustments
  FOR DELETE USING (auth.uid() = user_id);

