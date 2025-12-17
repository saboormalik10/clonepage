-- Fix publications table schema to handle decimal values
-- Run this in Supabase SQL Editor

-- Change domain_authority and domain_rating from BIGINT to NUMERIC to handle decimals
ALTER TABLE publications 
  ALTER COLUMN domain_authority TYPE NUMERIC USING domain_authority::NUMERIC,
  ALTER COLUMN domain_rating TYPE NUMERIC USING domain_rating::NUMERIC;

-- Also ensure multiplier fields can handle both text and numeric values
-- (They should already be TEXT but let's make sure)
ALTER TABLE publications 
  ALTER COLUMN health_multiplier TYPE TEXT,
  ALTER COLUMN cbd_multiplier TYPE TEXT,
  ALTER COLUMN crypto_multiplier TYPE TEXT,
  ALTER COLUMN gambling_multiplier TYPE TEXT,
  ALTER COLUMN erotic_multiplier TYPE TEXT,
  ALTER COLUMN erotic_price TYPE TEXT;

-- Add some indexes for better performance
CREATE INDEX IF NOT EXISTS idx_publications_domain_authority ON publications(domain_authority);
CREATE INDEX IF NOT EXISTS idx_publications_domain_rating ON publications(domain_rating);
CREATE INDEX IF NOT EXISTS idx_publications_name ON publications(name);

COMMIT;