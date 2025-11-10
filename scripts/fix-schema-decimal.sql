-- Fix schema to support decimal values in domain_authority and domain_rating
-- Run this in Supabase SQL Editor to update the table schema

-- Alter the columns to support decimals
ALTER TABLE publications 
  ALTER COLUMN domain_authority TYPE NUMERIC USING domain_authority::NUMERIC,
  ALTER COLUMN domain_rating TYPE NUMERIC USING domain_rating::NUMERIC;


