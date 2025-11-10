-- Supabase Schema Setup Script
-- Run this in your Supabase SQL Editor

-- ============================================
-- TABLES
-- ============================================

-- Publications Table
CREATE TABLE IF NOT EXISTS publications (
  _id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  logo JSONB,
  genres JSONB DEFAULT '[]'::jsonb,
  default_price JSONB DEFAULT '[]'::jsonb,
  custom_price JSONB DEFAULT '[]'::jsonb,
  domain_authority NUMERIC,
  domain_rating NUMERIC,
  estimated_time TEXT,
  regions JSONB DEFAULT '[]'::jsonb,
  sponsored TEXT,
  indexed TEXT,
  do_follow TEXT,
  article_preview JSONB,
  image TEXT,
  url TEXT,
  health BOOLEAN,
  health_multiplier TEXT,
  cbd BOOLEAN,
  cbd_multiplier TEXT,
  crypto BOOLEAN,
  crypto_multiplier TEXT,
  gambling BOOLEAN,
  gambling_multiplier TEXT,
  erotic BOOLEAN,
  erotic_multiplier TEXT,
  erotic_price INTEGER,
  badges JSONB DEFAULT '[]'::jsonb,
  business JSONB,
  is_presale BOOLEAN,
  listicles JSONB,
  more_info TEXT,
  sale_expire_date TIMESTAMP WITH TIME ZONE,
  sale_price NUMERIC,
  show_on_sale BOOLEAN,
  slug TEXT,
  img_explain TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Social Posts Table
CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication TEXT NOT NULL,
  image TEXT,
  url TEXT,
  platforms TEXT[] DEFAULT ARRAY[]::TEXT[],
  price TEXT,
  tat TEXT,
  example_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Digital TV Table
CREATE TABLE IF NOT EXISTS digital_tv (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sign TEXT,
  station TEXT NOT NULL,
  rate TEXT,
  tat TEXT,
  sponsored TEXT,
  indexed TEXT,
  segment_length TEXT,
  location TEXT,
  program_name TEXT,
  interview_type TEXT,
  example_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Best Sellers Table
CREATE TABLE IF NOT EXISTS best_sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication TEXT NOT NULL,
  image TEXT,
  genres TEXT,
  price TEXT,
  da TEXT,
  dr TEXT,
  tat TEXT,
  region TEXT,
  sponsored TEXT,
  indexed TEXT,
  dofollow TEXT,
  example_url TEXT,
  has_image TEXT,
  niches TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Listicles Table
CREATE TABLE IF NOT EXISTS listicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication TEXT NOT NULL,
  image TEXT,
  genres TEXT,
  price TEXT,
  da TEXT,
  dr TEXT,
  tat TEXT,
  region TEXT,
  sponsored TEXT,
  indexed TEXT,
  dofollow TEXT,
  example_url TEXT,
  has_image TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PR Bundles Table
CREATE TABLE IF NOT EXISTS pr_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  bundles JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Print Table
CREATE TABLE IF NOT EXISTS print (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  magazines JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Broadcast TV Table
CREATE TABLE IF NOT EXISTS broadcast_tv (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate TEXT,
  calls TEXT,
  state TEXT,
  market TEXT,
  program TEXT,
  location TEXT,
  time TEXT,
  rate TEXT,
  example_url TEXT,
  intake_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE digital_tv ENABLE ROW LEVEL SECURITY;
ALTER TABLE best_sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE listicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pr_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE print ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_tv ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access" ON publications;
DROP POLICY IF EXISTS "Allow public insert access" ON publications;
DROP POLICY IF EXISTS "Allow public update access" ON publications;

DROP POLICY IF EXISTS "Allow public read access" ON social_posts;
DROP POLICY IF EXISTS "Allow public insert access" ON social_posts;
DROP POLICY IF EXISTS "Allow public update access" ON social_posts;

DROP POLICY IF EXISTS "Allow public read access" ON digital_tv;
DROP POLICY IF EXISTS "Allow public insert access" ON digital_tv;
DROP POLICY IF EXISTS "Allow public update access" ON digital_tv;

DROP POLICY IF EXISTS "Allow public read access" ON best_sellers;
DROP POLICY IF EXISTS "Allow public insert access" ON best_sellers;
DROP POLICY IF EXISTS "Allow public update access" ON best_sellers;

DROP POLICY IF EXISTS "Allow public read access" ON listicles;
DROP POLICY IF EXISTS "Allow public insert access" ON listicles;
DROP POLICY IF EXISTS "Allow public update access" ON listicles;

DROP POLICY IF EXISTS "Allow public read access" ON pr_bundles;
DROP POLICY IF EXISTS "Allow public insert access" ON pr_bundles;
DROP POLICY IF EXISTS "Allow public update access" ON pr_bundles;

DROP POLICY IF EXISTS "Allow public read access" ON print;
DROP POLICY IF EXISTS "Allow public insert access" ON print;
DROP POLICY IF EXISTS "Allow public update access" ON print;

DROP POLICY IF EXISTS "Allow public read access" ON broadcast_tv;
DROP POLICY IF EXISTS "Allow public insert access" ON broadcast_tv;
DROP POLICY IF EXISTS "Allow public update access" ON broadcast_tv;

-- Create policies for publications
CREATE POLICY "Allow public read access" ON publications
  FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON publications
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON publications
  FOR UPDATE USING (true);

-- Create policies for social_posts
CREATE POLICY "Allow public read access" ON social_posts
  FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON social_posts
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON social_posts
  FOR UPDATE USING (true);

-- Create policies for digital_tv
CREATE POLICY "Allow public read access" ON digital_tv
  FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON digital_tv
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON digital_tv
  FOR UPDATE USING (true);

-- Create policies for best_sellers
CREATE POLICY "Allow public read access" ON best_sellers
  FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON best_sellers
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON best_sellers
  FOR UPDATE USING (true);

-- Create policies for listicles
CREATE POLICY "Allow public read access" ON listicles
  FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON listicles
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON listicles
  FOR UPDATE USING (true);

-- Create policies for pr_bundles
CREATE POLICY "Allow public read access" ON pr_bundles
  FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON pr_bundles
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON pr_bundles
  FOR UPDATE USING (true);

-- Create policies for print
CREATE POLICY "Allow public read access" ON print
  FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON print
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON print
  FOR UPDATE USING (true);

-- Create policies for broadcast_tv
CREATE POLICY "Allow public read access" ON broadcast_tv
  FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON broadcast_tv
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON broadcast_tv
  FOR UPDATE USING (true);


