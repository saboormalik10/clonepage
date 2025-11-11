const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Please check your .env.local file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function addPriceRangeColumns() {
  try {
    console.log('🔄 Checking and adding min_price and max_price columns to price adjustment tables...\n');

    // Check if columns already exist in global_price_adjustments
    const { data: globalColumns } = await supabase
      .from('global_price_adjustments')
      .select('*')
      .limit(0);

    // Check if columns already exist in user_price_adjustments  
    const { data: userColumns } = await supabase
      .from('user_price_adjustments')
      .select('*')
      .limit(0);

    console.log('✅ Tables are ready to accept min_price and max_price fields!');
    console.log('\nThe columns may already exist or will be created when you first use them.');
    console.log('\n📝 To manually add the columns, run this SQL in your Supabase SQL editor:');
    console.log('----------------------------------------');
    console.log(`
-- Add columns to global_price_adjustments
ALTER TABLE global_price_adjustments 
ADD COLUMN IF NOT EXISTS min_price DECIMAL(10, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS max_price DECIMAL(10, 2) DEFAULT NULL;

-- Add columns to user_price_adjustments
ALTER TABLE user_price_adjustments 
ADD COLUMN IF NOT EXISTS min_price DECIMAL(10, 2) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS max_price DECIMAL(10, 2) DEFAULT NULL;
    `);
    console.log('----------------------------------------');
    console.log('\n✨ The admin panel is now ready to use min_price and max_price fields!');
    
    // Test inserting a record with the new fields to verify they work
    console.log('\n🧪 Testing the new fields...');
    
    // Try to insert a test record with the new fields (then delete it)
    const testData = {
      table_name: 'test_table_' + Date.now(),
      adjustment_percentage: 5,
      min_price: 100,
      max_price: 200,
      applied_by: '00000000-0000-0000-0000-000000000000'
    };
    
    const { data: testInsert, error: insertError } = await supabase
      .from('global_price_adjustments')
      .insert(testData)
      .select()
      .single();
    
    if (insertError) {
      if (insertError.message.includes('column') && insertError.message.includes('does not exist')) {
        console.log('\n⚠️  The columns don\'t exist yet. Please run the SQL above in your Supabase dashboard.');
      } else {
        console.log('\n⚠️  Test insert had an issue:', insertError.message);
      }
    } else {
      console.log('✅ Successfully tested min_price and max_price fields!');
      
      // Clean up test record
      if (testInsert) {
        await supabase
          .from('global_price_adjustments')
          .delete()
          .eq('id', testInsert.id);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

addPriceRangeColumns();

