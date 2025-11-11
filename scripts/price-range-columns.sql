-- Add min_price and max_price columns to global_price_adjustments table
ALTER TABLE global_price_adjustments 
ADD COLUMN IF NOT EXISTS min_price DECIMAL(10, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS max_price DECIMAL(10, 2) DEFAULT NULL;

-- Add min_price and max_price columns to user_price_adjustments table
ALTER TABLE user_price_adjustments 
ADD COLUMN IF NOT EXISTS min_price DECIMAL(10, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS max_price DECIMAL(10, 2) DEFAULT NULL;

-- Add comments for clarity
COMMENT ON COLUMN global_price_adjustments.min_price IS 'Minimum price for this adjustment to apply';
COMMENT ON COLUMN global_price_adjustments.max_price IS 'Maximum price for this adjustment to apply';
COMMENT ON COLUMN user_price_adjustments.min_price IS 'Minimum price for this adjustment to apply';
COMMENT ON COLUMN user_price_adjustments.max_price IS 'Maximum price for this adjustment to apply';

