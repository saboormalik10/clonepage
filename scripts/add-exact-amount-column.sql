-- Add exact_amount column to global_price_adjustments table
ALTER TABLE global_price_adjustments 
ADD COLUMN IF NOT EXISTS exact_amount DECIMAL(10, 2) DEFAULT NULL;

-- Add exact_amount column to user_price_adjustments table
ALTER TABLE user_price_adjustments 
ADD COLUMN IF NOT EXISTS exact_amount DECIMAL(10, 2) DEFAULT NULL;

-- Add comments for clarity
COMMENT ON COLUMN global_price_adjustments.exact_amount IS 'Exact dollar amount to replace price (if set, replaces adjustment_percentage)';
COMMENT ON COLUMN user_price_adjustments.exact_amount IS 'Exact dollar amount to replace price (if set, replaces adjustment_percentage)';

