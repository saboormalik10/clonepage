-- Run this SQL in your Supabase SQL Editor to fix RLS policies
-- This allows public read and insert/update access for migrations

-- Publications table
ALTER TABLE publications ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Allow public read access" ON publications;

-- Create policies for read and write
CREATE POLICY "Allow public read access" ON publications
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON publications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access" ON publications
  FOR UPDATE USING (true);

-- Repeat for other tables if needed
-- Social Posts
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access" ON social_posts;
CREATE POLICY "Allow public read access" ON social_posts FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON social_posts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON social_posts FOR UPDATE USING (true);

-- Digital TV
ALTER TABLE digital_tv ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access" ON digital_tv;
CREATE POLICY "Allow public read access" ON digital_tv FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON digital_tv FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON digital_tv FOR UPDATE USING (true);

-- Best Sellers
ALTER TABLE best_sellers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access" ON best_sellers;
CREATE POLICY "Allow public read access" ON best_sellers FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON best_sellers FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON best_sellers FOR UPDATE USING (true);

-- Listicles
ALTER TABLE listicles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access" ON listicles;
CREATE POLICY "Allow public read access" ON listicles FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON listicles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON listicles FOR UPDATE USING (true);

-- PR Bundles
ALTER TABLE pr_bundles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access" ON pr_bundles;
CREATE POLICY "Allow public read access" ON pr_bundles FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON pr_bundles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON pr_bundles FOR UPDATE USING (true);

-- Print
ALTER TABLE print ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access" ON print;
CREATE POLICY "Allow public read access" ON print FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON print FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON print FOR UPDATE USING (true);

-- Broadcast TV
ALTER TABLE broadcast_tv ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access" ON broadcast_tv;
CREATE POLICY "Allow public read access" ON broadcast_tv FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON broadcast_tv FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON broadcast_tv FOR UPDATE USING (true);



