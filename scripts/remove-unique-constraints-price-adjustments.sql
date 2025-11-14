-- Remove UNIQUE constraints to allow multiple price adjustments per table/user
-- This migration enables multiple adjustments for the same table_name (global) or user_id+table_name (user)

-- Remove UNIQUE constraint from global_price_adjustments
ALTER TABLE global_price_adjustments 
DROP CONSTRAINT IF EXISTS global_price_adjustments_table_name_key;

-- Remove UNIQUE constraint from user_price_adjustments
ALTER TABLE user_price_adjustments 
DROP CONSTRAINT IF EXISTS user_price_adjustments_user_id_table_name_key;

-- Note: After this migration, you can have multiple adjustments for:
-- - The same table_name in global_price_adjustments
-- - The same user_id + table_name combination in user_price_adjustments

