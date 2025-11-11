const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Please check your .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function addPriceRangeColumns() {
  try {
    console.log('Adding min_price and max_price columns to price adjustment tables...');

    // Add columns to global_price_adjustments
    const { error: globalError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE global_price_adjustments 
        ADD COLUMN IF NOT EXISTS min_price DECIMAL(10, 2) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS max_price DECIMAL(10, 2) DEFAULT NULL;
      `
    }).single();

    if (globalError && !globalError.message.includes('already exists')) {
      console.error('Error adding columns to global_price_adjustments:', globalError);
    } else {
      console.log('✓ Added columns to global_price_adjustments');
    }

    // Add columns to user_price_adjustments
    const { error: userError } = await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE user_price_adjustments 
        ADD COLUMN IF NOT EXISTS min_price DECIMAL(10, 2) DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS max_price DECIMAL(10, 2) DEFAULT NULL;
      `
    }).single();

    if (userError && !userError.message.includes('already exists')) {
      console.error('Error adding columns to user_price_adjustments:', userError);
    } else {
      console.log('✓ Added columns to user_price_adjustments');
    }

    console.log('\n✅ Successfully added price range columns to both tables!');
    console.log('\nYou can now use min_price and max_price fields in the admin panel.');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

addPriceRangeColumns();

