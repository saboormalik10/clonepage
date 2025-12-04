-- Add brand_name and brand_logo fields to user_profiles table
-- Run this in your Supabase SQL Editor

-- Add brand_name column (nullable, can be added later)
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS brand_name TEXT;

-- Add brand_logo column (nullable, stores URL to logo image)
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS brand_logo TEXT;

-- Add comment for documentation
COMMENT ON COLUMN user_profiles.brand_name IS 'Brand name for the user, replaces "Hotshot Social" in the UI';
COMMENT ON COLUMN user_profiles.brand_logo IS 'URL to the brand logo image, replaces default logo in the UI';

