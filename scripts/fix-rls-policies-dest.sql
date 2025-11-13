-- Fix RLS policies for all data tables in destination database
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/fzorirzobvypsachtwkx/sql

-- Enable RLS on all tables (if not already enabled)
ALTER TABLE IF EXISTS publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS digital_tv ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS best_sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS listicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS pr_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS print ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS broadcast_tv ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS global_price_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_price_adjustments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow public read access" ON publications;
DROP POLICY IF EXISTS "Allow public read access" ON social_posts;
DROP POLICY IF EXISTS "Allow public read access" ON digital_tv;
DROP POLICY IF EXISTS "Allow public read access" ON best_sellers;
DROP POLICY IF EXISTS "Allow public read access" ON listicles;
DROP POLICY IF EXISTS "Allow public read access" ON pr_bundles;
DROP POLICY IF EXISTS "Allow public read access" ON print;
DROP POLICY IF EXISTS "Allow public read access" ON broadcast_tv;

-- Create policies to allow public read access (for API routes)
-- Publications
CREATE POLICY "Allow public read access" ON publications
  FOR SELECT USING (true);

-- Social Posts
CREATE POLICY "Allow public read access" ON social_posts
  FOR SELECT USING (true);

-- Digital TV
CREATE POLICY "Allow public read access" ON digital_tv
  FOR SELECT USING (true);

-- Best Sellers
CREATE POLICY "Allow public read access" ON best_sellers
  FOR SELECT USING (true);

-- Listicles
CREATE POLICY "Allow public read access" ON listicles
  FOR SELECT USING (true);

-- PR Bundles
CREATE POLICY "Allow public read access" ON pr_bundles
  FOR SELECT USING (true);

-- Print
CREATE POLICY "Allow public read access" ON print
  FOR SELECT USING (true);

-- Broadcast TV
CREATE POLICY "Allow public read access" ON broadcast_tv
  FOR SELECT USING (true);

-- Global Price Adjustments (already has policy, but ensure it exists)
DROP POLICY IF EXISTS "Allow public read access" ON global_price_adjustments;
CREATE POLICY "Allow public read access" ON global_price_adjustments
  FOR SELECT USING (true);

-- User Price Adjustments (users can only see their own)
DROP POLICY IF EXISTS "Users can view own adjustments" ON user_price_adjustments;
CREATE POLICY "Users can view own adjustments" ON user_price_adjustments
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can view all user adjustments
DROP POLICY IF EXISTS "Admins can view all adjustments" ON user_price_adjustments;
CREATE POLICY "Admins can view all adjustments" ON user_price_adjustments
  FOR SELECT USING (public.is_admin(auth.uid()));

-- Grant SELECT permissions to authenticated and anon roles
GRANT SELECT ON publications TO authenticated, anon;
GRANT SELECT ON social_posts TO authenticated, anon;
GRANT SELECT ON digital_tv TO authenticated, anon;
GRANT SELECT ON best_sellers TO authenticated, anon;
GRANT SELECT ON listicles TO authenticated, anon;
GRANT SELECT ON pr_bundles TO authenticated, anon;
GRANT SELECT ON print TO authenticated, anon;
GRANT SELECT ON broadcast_tv TO authenticated, anon;
GRANT SELECT ON global_price_adjustments TO authenticated, anon;
GRANT SELECT ON user_price_adjustments TO authenticated;

-- Verify policies were created
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

