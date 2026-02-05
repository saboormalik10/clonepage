-- Fix publications table column types to accept decimal values
-- Run this in Supabase SQL Editor before migrating data

-- First, drop the table if it exists and recreate with correct types
DROP TABLE IF EXISTS "publications" CASCADE;

CREATE TABLE IF NOT EXISTS "publications" (
  "_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT,
  "logo" JSONB DEFAULT '{}'::jsonb,
  "genres" JSONB DEFAULT '[]'::jsonb,
  "default_price" JSONB DEFAULT '[]'::jsonb,
  "custom_price" TEXT,
  "domain_authority" TEXT,
  "domain_rating" TEXT,
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

-- Allow public access
DROP POLICY IF EXISTS "Allow public read access" ON "publications";
DROP POLICY IF EXISTS "Allow public insert access" ON "publications";
DROP POLICY IF EXISTS "Allow public update access" ON "publications";
DROP POLICY IF EXISTS "Allow public delete access" ON "publications";

CREATE POLICY "Allow public read access" ON "publications" FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON "publications" FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON "publications" FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON "publications" FOR DELETE USING (true);
