-- SQL to create tables in destination database
-- Generated: 2025-11-12T18:20:10.264Z
-- Source: https://sejgcgatlggiznkcimvz.supabase.co
-- Destination: https://fzorirzobvypsachtwkx.supabase.co

-- First, create exec_sql function:
CREATE OR REPLACE FUNCTION exec_sql(sql_text text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_text;
END;
$$;

-- Then create tables:

-- Table: publications
CREATE TABLE IF NOT EXISTS "publications" ("_id" TEXT, "name" TEXT, "logo" JSONB, "genres" JSONB, "default_price" JSONB, "custom_price" JSONB, "domain_authority" BIGINT, "domain_rating" BIGINT, "estimated_time" TEXT, "regions" JSONB, "sponsored" TEXT, "indexed" TEXT, "do_follow" TEXT, "article_preview" JSONB, "image" TEXT, "url" TEXT, "health" TEXT, "health_multiplier" TEXT, "cbd" TEXT, "cbd_multiplier" TEXT, "crypto" BOOLEAN, "crypto_multiplier" TEXT, "gambling" TEXT, "gambling_multiplier" TEXT, "erotic" TEXT, "erotic_multiplier" TEXT, "erotic_price" TEXT, "created_at" TEXT, "updated_at" TEXT, "badges" JSONB, "business" JSONB, "is_presale" TEXT, "more_info" TEXT, "sale_expire_date" TEXT, "sale_price" TEXT, "show_on_sale" TEXT, "slug" TEXT, "img_explain" TEXT, "listicles" TEXT);

-- Table: social_posts
CREATE TABLE IF NOT EXISTS "social_posts" ("id" TEXT, "publication" TEXT, "image" TEXT, "url" TEXT, "platforms" JSONB, "price" TEXT, "tat" TEXT, "example_url" TEXT, "created_at" TEXT);

-- Table: digital_tv
CREATE TABLE IF NOT EXISTS "digital_tv" ("id" TEXT, "call_sign" TEXT, "station" TEXT, "rate" TEXT, "tat" TEXT, "sponsored" TEXT, "indexed" TEXT, "segment_length" TEXT, "location" TEXT, "program_name" TEXT, "interview_type" TEXT, "example_url" TEXT, "created_at" TEXT);

-- Table: best_sellers
CREATE TABLE IF NOT EXISTS "best_sellers" ("id" TEXT, "publication" TEXT, "image" TEXT, "genres" TEXT, "price" TEXT, "da" TEXT, "dr" TEXT, "tat" TEXT, "region" TEXT, "sponsored" TEXT, "indexed" TEXT, "dofollow" TEXT, "example_url" TEXT, "has_image" TEXT, "niches" TEXT, "created_at" TEXT);

-- Table: listicles
CREATE TABLE IF NOT EXISTS "listicles" ("id" TEXT, "publication" TEXT, "image" TEXT, "genres" TEXT, "price" TEXT, "da" TEXT, "dr" TEXT, "tat" TEXT, "region" TEXT, "sponsored" TEXT, "indexed" TEXT, "dofollow" TEXT, "example_url" TEXT, "has_image" TEXT, "created_at" TEXT);

-- Table: pr_bundles
CREATE TABLE IF NOT EXISTS "pr_bundles" ("id" TEXT, "category" TEXT, "bundles" JSONB, "created_at" TEXT);

-- Table: print
CREATE TABLE IF NOT EXISTS "print" ("id" TEXT, "category" TEXT, "magazines" JSONB, "created_at" TEXT);

-- Table: broadcast_tv
CREATE TABLE IF NOT EXISTS "broadcast_tv" ("id" TEXT, "affiliate" TEXT, "calls" TEXT, "state" TEXT, "market" TEXT, "program" TEXT, "location" TEXT, "time" TEXT, "rate" TEXT, "example_url" TEXT, "intake_url" TEXT, "created_at" TEXT);

-- Table: global_price_adjustments
CREATE TABLE IF NOT EXISTS "global_price_adjustments" ("id" TEXT, "table_name" TEXT, "adjustment_percentage" BIGINT, "applied_by" TEXT, "created_at" TEXT, "updated_at" TEXT, "min_price" BIGINT, "max_price" BIGINT);

-- Table: user_price_adjustments
CREATE TABLE IF NOT EXISTS "user_price_adjustments" ("id" TEXT, "user_id" TEXT, "table_name" TEXT, "adjustment_percentage" BIGINT, "created_at" TEXT, "updated_at" TEXT, "min_price" BIGINT, "max_price" BIGINT);

