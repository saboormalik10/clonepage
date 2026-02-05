-- Auto-generated migration schema
-- Run this in Supabase SQL Editor BEFORE running data migration
-- Generated: 2026-02-04T20:19:37.136Z

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Helper function to check if user is admin
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


-- Table: pr_bundles
CREATE TABLE IF NOT EXISTS "pr_bundles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "category" TEXT NOT NULL,
  "bundles" JSONB DEFAULT '[]'::jsonb,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE "pr_bundles" ENABLE ROW LEVEL SECURITY;

-- Allow public access (adjust as needed)
CREATE POLICY "Allow public read access" ON "pr_bundles" FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON "pr_bundles" FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON "pr_bundles" FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON "pr_bundles" FOR DELETE USING (true);

-- Table: user_price_adjustments
CREATE TABLE IF NOT EXISTS "user_price_adjustments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "table_name" TEXT,
  "adjustment_percentage" INTEGER,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "min_price" TEXT,
  "max_price" INTEGER,
  "exact_amount" TEXT
);

-- Enable RLS
ALTER TABLE "user_price_adjustments" ENABLE ROW LEVEL SECURITY;

-- Allow public access (adjust as needed)
CREATE POLICY "Allow public read access" ON "user_price_adjustments" FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON "user_price_adjustments" FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON "user_price_adjustments" FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON "user_price_adjustments" FOR DELETE USING (true);

-- Table: best_sellers
CREATE TABLE IF NOT EXISTS "best_sellers" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "publication" TEXT,
  "image" TEXT,
  "genres" TEXT,
  "price" TEXT,
  "da" TEXT,
  "dr" TEXT,
  "tat" TEXT,
  "region" TEXT,
  "sponsored" TEXT,
  "indexed" TEXT,
  "dofollow" TEXT,
  "example_url" TEXT,
  "has_image" TEXT,
  "niches" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE "best_sellers" ENABLE ROW LEVEL SECURITY;

-- Allow public access (adjust as needed)
CREATE POLICY "Allow public read access" ON "best_sellers" FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON "best_sellers" FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON "best_sellers" FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON "best_sellers" FOR DELETE USING (true);

-- Table: publications
CREATE TABLE IF NOT EXISTS "publications" (
  "_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT,
  "logo" JSONB DEFAULT '{}'::jsonb,
  "genres" JSONB DEFAULT '[]'::jsonb,
  "default_price" JSONB DEFAULT '[]'::jsonb,
  "custom_price" TEXT,
  "domain_authority" INTEGER,
  "domain_rating" INTEGER,
  "estimated_time" TEXT,
  "regions" JSONB DEFAULT '[]'::jsonb,
  "sponsored" TEXT,
  "indexed" TEXT,
  "do_follow" TEXT,
  "article_preview" JSONB DEFAULT '{}'::jsonb,
  "image" TEXT,
  "url" TEXT,
  "health" BOOLEAN DEFAULT false,
  "health_multiplier" TEXT,
  "cbd" BOOLEAN DEFAULT false,
  "cbd_multiplier" TEXT,
  "crypto" BOOLEAN DEFAULT false,
  "crypto_multiplier" TEXT,
  "gambling" BOOLEAN DEFAULT false,
  "gambling_multiplier" TEXT,
  "erotic" BOOLEAN DEFAULT false,
  "erotic_multiplier" TEXT,
  "erotic_price" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "badges" JSONB DEFAULT '[]'::jsonb,
  "business" TEXT,
  "is_presale" TEXT,
  "more_info" TEXT,
  "sale_expire_date" TEXT,
  "sale_price" TEXT,
  "show_on_sale" TEXT,
  "slug" TEXT,
  "img_explain" TEXT,
  "listicles" TEXT
);

-- Enable RLS
ALTER TABLE "publications" ENABLE ROW LEVEL SECURITY;

-- Allow public access (adjust as needed)
CREATE POLICY "Allow public read access" ON "publications" FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON "publications" FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON "publications" FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON "publications" FOR DELETE USING (true);

-- Table: broadcast_tv
CREATE TABLE IF NOT EXISTS "broadcast_tv" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "affiliate" TEXT,
  "calls" TEXT,
  "state" TEXT,
  "market" TEXT,
  "program" TEXT,
  "location" TEXT,
  "time" TEXT,
  "rate" TEXT,
  "example_url" TEXT,
  "intake_url" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE "broadcast_tv" ENABLE ROW LEVEL SECURITY;

-- Allow public access (adjust as needed)
CREATE POLICY "Allow public read access" ON "broadcast_tv" FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON "broadcast_tv" FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON "broadcast_tv" FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON "broadcast_tv" FOR DELETE USING (true);

-- Table: others
CREATE TABLE IF NOT EXISTS "others" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "category" TEXT NOT NULL,
  "items" JSONB DEFAULT '[]'::jsonb,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE "others" ENABLE ROW LEVEL SECURITY;

-- Allow public access (adjust as needed)
CREATE POLICY "Allow public read access" ON "others" FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON "others" FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON "others" FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON "others" FOR DELETE USING (true);

-- Table: broadcast_message_recipients
CREATE TABLE IF NOT EXISTS "broadcast_message_recipients" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "message_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "is_read" BOOLEAN DEFAULT false,
  "is_closed" BOOLEAN DEFAULT false,
  "read_at" TIMESTAMP WITH TIME ZONE,
  "closed_at" TIMESTAMP WITH TIME ZONE,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- Enable RLS
ALTER TABLE "broadcast_message_recipients" ENABLE ROW LEVEL SECURITY;

-- Allow public access (adjust as needed)
CREATE POLICY "Allow public read access" ON "broadcast_message_recipients" FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON "broadcast_message_recipients" FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON "broadcast_message_recipients" FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON "broadcast_message_recipients" FOR DELETE USING (true);

-- Table: global_price_adjustments
CREATE TABLE IF NOT EXISTS "global_price_adjustments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "table_name" TEXT,
  "adjustment_percentage" INTEGER,
  "applied_by" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "min_price" INTEGER,
  "max_price" INTEGER,
  "exact_amount" TEXT
);

-- Enable RLS
ALTER TABLE "global_price_adjustments" ENABLE ROW LEVEL SECURITY;

-- Allow public access (adjust as needed)
CREATE POLICY "Allow public read access" ON "global_price_adjustments" FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON "global_price_adjustments" FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON "global_price_adjustments" FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON "global_price_adjustments" FOR DELETE USING (true);

-- Table: listicles
CREATE TABLE IF NOT EXISTS "listicles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "publication" TEXT,
  "image" TEXT,
  "genres" TEXT,
  "price" TEXT,
  "da" TEXT,
  "dr" TEXT,
  "tat" TEXT,
  "region" TEXT,
  "sponsored" TEXT,
  "indexed" TEXT,
  "dofollow" TEXT,
  "example_url" TEXT,
  "has_image" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE "listicles" ENABLE ROW LEVEL SECURITY;

-- Allow public access (adjust as needed)
CREATE POLICY "Allow public read access" ON "listicles" FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON "listicles" FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON "listicles" FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON "listicles" FOR DELETE USING (true);

-- Table: user_profiles
CREATE TABLE IF NOT EXISTS "user_profiles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" TEXT,
  "full_name" TEXT,
  "role" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "brand_name" TEXT,
  "brand_logo" TEXT
);

-- Enable RLS
ALTER TABLE "user_profiles" ENABLE ROW LEVEL SECURITY;

-- Allow public access (adjust as needed)
CREATE POLICY "Allow public read access" ON "user_profiles" FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON "user_profiles" FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON "user_profiles" FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON "user_profiles" FOR DELETE USING (true);

-- Table: broadcast_messages
CREATE TABLE IF NOT EXISTS "broadcast_messages" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "created_by" UUID NOT NULL,
  "send_to_all" BOOLEAN DEFAULT false,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE "broadcast_messages" ENABLE ROW LEVEL SECURITY;

-- Allow public access (adjust as needed)
CREATE POLICY "Allow public read access" ON "broadcast_messages" FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON "broadcast_messages" FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON "broadcast_messages" FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON "broadcast_messages" FOR DELETE USING (true);

-- Table: admin_settings
CREATE TABLE IF NOT EXISTS "admin_settings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "setting_key" TEXT,
  "setting_value" TEXT,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_by" TEXT
);

-- Enable RLS
ALTER TABLE "admin_settings" ENABLE ROW LEVEL SECURITY;

-- Allow public access (adjust as needed)
CREATE POLICY "Allow public read access" ON "admin_settings" FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON "admin_settings" FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON "admin_settings" FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON "admin_settings" FOR DELETE USING (true);

-- Table: tab_visibility
CREATE TABLE IF NOT EXISTS "tab_visibility" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tab_id" UUID,
  "tab_name" TEXT,
  "is_visible" BOOLEAN DEFAULT false,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE "tab_visibility" ENABLE ROW LEVEL SECURITY;

-- Allow public access (adjust as needed)
CREATE POLICY "Allow public read access" ON "tab_visibility" FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON "tab_visibility" FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON "tab_visibility" FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON "tab_visibility" FOR DELETE USING (true);

-- Table: social_posts
CREATE TABLE IF NOT EXISTS "social_posts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "publication" TEXT,
  "image" TEXT,
  "url" TEXT,
  "platforms" JSONB DEFAULT '[]'::jsonb,
  "price" TEXT,
  "tat" TEXT,
  "example_url" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE "social_posts" ENABLE ROW LEVEL SECURITY;

-- Allow public access (adjust as needed)
CREATE POLICY "Allow public read access" ON "social_posts" FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON "social_posts" FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON "social_posts" FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON "social_posts" FOR DELETE USING (true);

-- Table: print
CREATE TABLE IF NOT EXISTS "print" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "category" TEXT,
  "magazines" JSONB DEFAULT '[]'::jsonb,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE "print" ENABLE ROW LEVEL SECURITY;

-- Allow public access (adjust as needed)
CREATE POLICY "Allow public read access" ON "print" FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON "print" FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON "print" FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON "print" FOR DELETE USING (true);

-- Table: digital_tv
CREATE TABLE IF NOT EXISTS "digital_tv" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "call_sign" TEXT,
  "station" TEXT,
  "rate" TEXT,
  "tat" TEXT,
  "sponsored" TEXT,
  "indexed" TEXT,
  "segment_length" TEXT,
  "location" TEXT,
  "program_name" TEXT,
  "interview_type" TEXT,
  "example_url" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE "digital_tv" ENABLE ROW LEVEL SECURITY;

-- Allow public access (adjust as needed)
CREATE POLICY "Allow public read access" ON "digital_tv" FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON "digital_tv" FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON "digital_tv" FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON "digital_tv" FOR DELETE USING (true);

-- User profiles table (links to auth.users)
CREATE TABLE IF NOT EXISTS "user_profiles" (
  "id" UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  "email" TEXT NOT NULL,
  "full_name" TEXT,
  "role" TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(email)
);

ALTER TABLE "user_profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON user_profiles FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can insert profiles" ON user_profiles FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update profiles" ON user_profiles FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "Service role full access" ON user_profiles FOR ALL USING (true);
