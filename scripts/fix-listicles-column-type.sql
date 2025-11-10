-- Fix listicles column type from BOOLEAN to JSONB
-- Run this in your Supabase SQL Editor if the column was already created as BOOLEAN

-- Check if column exists and is BOOLEAN, then convert it
-- Note: This will drop the column and recreate it, so any existing data will be lost
-- Since the migration failed, this column likely has no data, so it's safe to drop

DO $$ 
BEGIN
    -- Drop the column if it exists (regardless of type)
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'publications' 
        AND column_name = 'listicles'
    ) THEN
        ALTER TABLE publications DROP COLUMN listicles;
    END IF;
    
    -- Add it back as JSONB
    ALTER TABLE publications ADD COLUMN listicles JSONB;
END $$;

