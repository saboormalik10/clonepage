-- Add missing fields to publications table
-- Run this in your Supabase SQL Editor if the table already exists

ALTER TABLE publications 
ADD COLUMN IF NOT EXISTS badges JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS business JSONB,
ADD COLUMN IF NOT EXISTS is_presale BOOLEAN,
ADD COLUMN IF NOT EXISTS listicles JSONB,
ADD COLUMN IF NOT EXISTS more_info TEXT,
ADD COLUMN IF NOT EXISTS sale_expire_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sale_price NUMERIC,
ADD COLUMN IF NOT EXISTS show_on_sale BOOLEAN,
ADD COLUMN IF NOT EXISTS slug TEXT,
ADD COLUMN IF NOT EXISTS img_explain TEXT;


