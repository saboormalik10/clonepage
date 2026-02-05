#!/usr/bin/env node

/**
 * Supabase Migration Script
 * Migrates all data from Supabase 1 to Supabase 2
 * Including: Tables, Data, Auth Users, Storage, RLS Policies
 */

const { createClient } = require('@supabase/supabase-js');

// Source Database (Supabase 1)
const SOURCE_URL = 'https://fzorirzobvypsachtwkx.supabase.co';
const SOURCE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6b3JpcnpvYnZ5cHNhY2h0d2t4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk1ODM4NCwiZXhwIjoyMDc4NTM0Mzg0fQ.k0GX7-GARsz80MdyBxw5alASDd7W9_aWdPANXuJQgN8';

// Destination Database (Supabase 2)
const DEST_URL = 'https://fgptzilqznazirjlwydg.supabase.co';
const DEST_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZncHR6aWxxem5hemlyamx3eWRnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDIyNDAwOCwiZXhwIjoyMDg1ODAwMDA4fQ.rk5dsDM8XARdtYGuqTIRU0VazMvfeUj29UHQYSJNpNg';

// Source Database connection string for direct PostgreSQL access
const SOURCE_DB_HOST = 'db.fzorirzobvypsachtwkx.supabase.co';
const DEST_DB_HOST = 'db.fgptzilqznazirjlwydg.supabase.co';

// Create clients with service role keys (admin access)
const sourceClient = createClient(SOURCE_URL, SOURCE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const destClient = createClient(DEST_URL, DEST_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Function to execute raw SQL via REST API
async function executeSQL(client, sql, isSource = true) {
  const url = isSource ? SOURCE_URL : DEST_URL;
  const key = isSource ? SOURCE_SERVICE_KEY : DEST_SERVICE_KEY;
  
  const response = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({ query: sql }),
  });
  
  if (!response.ok) {
    // Try alternative approach - direct query via postgrest
    return null;
  }
  
  return await response.json();
}

// Get table schema information
async function getTableSchemas() {
  log('\n📋 Fetching table schemas from source database...', 'cyan');
  
  // Query to get all tables and their columns
  const schemaQuery = `
    SELECT 
      t.table_name,
      json_agg(
        json_build_object(
          'column_name', c.column_name,
          'data_type', c.data_type,
          'udt_name', c.udt_name,
          'is_nullable', c.is_nullable,
          'column_default', c.column_default,
          'character_maximum_length', c.character_maximum_length
        ) ORDER BY c.ordinal_position
      ) as columns
    FROM information_schema.tables t
    JOIN information_schema.columns c ON t.table_name = c.table_name AND t.table_schema = c.table_schema
    WHERE t.table_schema = 'public' 
    AND t.table_type = 'BASE TABLE'
    GROUP BY t.table_name
    ORDER BY t.table_name;
  `;
  
  // Since we can't run raw SQL easily, let's use the REST API to fetch schema info
  const url = SOURCE_URL;
  const key = SOURCE_SERVICE_KEY;
  
  // First, get list of tables using a direct approach
  try {
    const tablesResponse = await fetch(`${url}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
      },
    });
    
    if (tablesResponse.ok) {
      const tablesData = await tablesResponse.json();
      log(`  ✓ Found schema information`, 'green');
      return tablesData;
    }
  } catch (err) {
    log(`  ⚠️  Could not fetch schema via REST: ${err.message}`, 'yellow');
  }
  
  return null;
}

async function getAllTables() {
  log('\n📋 Fetching all tables from source database...', 'cyan');
  
  // Try to get tables by making a request to the REST API root
  const url = SOURCE_URL;
  const key = SOURCE_SERVICE_KEY;
  
  try {
    const response = await fetch(`${url}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      // The response contains table definitions
      if (data && data.definitions) {
        const tables = Object.keys(data.definitions).filter(t => 
          !t.startsWith('_') && t !== 'rpc'
        );
        log(`  ✓ Found ${tables.length} tables from API`, 'green');
        return tables;
      }
    }
  } catch (err) {
    log(`  ⚠️  API fetch failed: ${err.message}`, 'yellow');
  }
  
  // Fallback to predefined list
  log('  ℹ️  Using predefined table list...', 'yellow');
  return [
    'user_profiles',
    'publications',
    'best_sellers',
    'broadcast_tv',
    'digital_tv',
    'listicles',
    'others',
    'pr_bundles',
    'print',
    'social_posts',
    'user_price_adjustments',
    'global_price_adjustments',
    'broadcast_messages',
    'broadcast_message_recipients',
    'tab_visibility',
    'admin_settings',
  ];
}

async function getTableData(tableName) {
  log(`  📥 Fetching data from "${tableName}"...`, 'blue');
  
  const { data, error, count } = await sourceClient
    .from(tableName)
    .select('*', { count: 'exact' });
  
  if (error) {
    log(`    ⚠️  Error fetching ${tableName}: ${error.message}`, 'yellow');
    return { data: [], count: 0 };
  }
  
  log(`    ✓ Found ${data?.length || 0} rows`, 'green');
  return { data: data || [], count: data?.length || 0 };
}

// Check if destination table already has data
async function checkDestinationTableHasData(tableName) {
  const { data, error, count } = await destClient
    .from(tableName)
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    // Table might not exist
    return { exists: false, count: 0 };
  }
  
  return { exists: true, count: count || 0 };
}

// Get the primary key column for a table
function getPrimaryKeyColumn(tableName) {
  // publications uses _id, all others use id
  if (tableName === 'publications') {
    return '_id';
  }
  return 'id';
}

async function insertTableData(tableName, data, skipIfExists = true) {
  if (!data || data.length === 0) {
    log(`    ⏭️  Skipping ${tableName} (no data)`, 'yellow');
    return { success: true, count: 0, skipped: false };
  }
  
  // Check if destination already has data
  if (skipIfExists) {
    const destCheck = await checkDestinationTableHasData(tableName);
    if (destCheck.exists && destCheck.count > 0) {
      log(`    ⏭️  Skipping ${tableName} (already has ${destCheck.count} rows in destination)`, 'yellow');
      return { success: true, count: destCheck.count, skipped: true };
    }
  }
  
  log(`  📤 Inserting ${data.length} rows into "${tableName}"...`, 'blue');
  
  // Get the correct primary key column for this table
  const primaryKey = getPrimaryKeyColumn(tableName);
  
  // Insert in batches of 100 to avoid timeout
  const batchSize = 100;
  let inserted = 0;
  
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    
    const { error } = await destClient
      .from(tableName)
      .upsert(batch, { onConflict: primaryKey, ignoreDuplicates: false });
    
    if (error) {
      log(`    ⚠️  Error inserting batch into ${tableName}: ${error.message}`, 'red');
      
      // Try inserting one by one to identify problematic rows
      for (const row of batch) {
        const { error: singleError } = await destClient
          .from(tableName)
          .upsert(row, { onConflict: primaryKey, ignoreDuplicates: true });
        
        if (!singleError) {
          inserted++;
        } else {
          log(`      ⚠️  Failed row: ${singleError.message}`, 'red');
        }
      }
    } else {
      inserted += batch.length;
    }
  }
  
  log(`    ✓ Inserted ${inserted} rows`, 'green');
  return { success: true, count: inserted };
}

async function migrateAuthUsers() {
  log('\n👥 Migrating Auth Users...', 'cyan');
  
  try {
    // List all users from source
    const { data: sourceUsers, error: listError } = await sourceClient.auth.admin.listUsers();
    
    if (listError) {
      log(`  ⚠️  Error listing users: ${listError.message}`, 'red');
      return { success: false, count: 0 };
    }
    
    if (!sourceUsers?.users || sourceUsers.users.length === 0) {
      log('  ℹ️  No auth users found in source database', 'yellow');
      return { success: true, count: 0 };
    }
    
    log(`  📥 Found ${sourceUsers.users.length} users in source`, 'blue');
    
    let migratedCount = 0;
    
    for (const user of sourceUsers.users) {
      try {
        // Create user in destination
        const { data: newUser, error: createError } = await destClient.auth.admin.createUser({
          email: user.email,
          email_confirm: user.email_confirmed_at ? true : false,
          phone: user.phone || undefined,
          phone_confirm: user.phone_confirmed_at ? true : false,
          user_metadata: user.user_metadata || {},
          app_metadata: user.app_metadata || {},
          // Note: We can't migrate passwords directly, users will need to reset
        });
        
        if (createError) {
          if (createError.message.includes('already been registered')) {
            log(`    ⏭️  User ${user.email} already exists`, 'yellow');
            migratedCount++;
          } else {
            log(`    ⚠️  Error creating user ${user.email}: ${createError.message}`, 'red');
          }
        } else {
          log(`    ✓ Migrated user: ${user.email}`, 'green');
          migratedCount++;
        }
      } catch (err) {
        log(`    ⚠️  Error with user ${user.email}: ${err.message}`, 'red');
      }
    }
    
    log(`  ✓ Migrated ${migratedCount}/${sourceUsers.users.length} users`, 'green');
    return { success: true, count: migratedCount };
    
  } catch (error) {
    log(`  ⚠️  Auth migration error: ${error.message}`, 'red');
    return { success: false, count: 0 };
  }
}

async function migrateStorage() {
  log('\n📦 Migrating Storage Buckets...', 'cyan');
  
  try {
    // List all buckets from source
    const { data: sourceBuckets, error: bucketsError } = await sourceClient.storage.listBuckets();
    
    if (bucketsError) {
      log(`  ⚠️  Error listing buckets: ${bucketsError.message}`, 'red');
      return { success: false };
    }
    
    if (!sourceBuckets || sourceBuckets.length === 0) {
      log('  ℹ️  No storage buckets found in source database', 'yellow');
      return { success: true };
    }
    
    log(`  📥 Found ${sourceBuckets.length} buckets`, 'blue');
    
    for (const bucket of sourceBuckets) {
      log(`  🪣 Processing bucket: ${bucket.name}`, 'blue');
      
      // Create bucket in destination
      const { error: createBucketError } = await destClient.storage.createBucket(bucket.name, {
        public: bucket.public,
        fileSizeLimit: bucket.file_size_limit,
        allowedMimeTypes: bucket.allowed_mime_types,
      });
      
      if (createBucketError && !createBucketError.message.includes('already exists')) {
        log(`    ⚠️  Error creating bucket ${bucket.name}: ${createBucketError.message}`, 'red');
        continue;
      }
      
      // List all files in the bucket
      const { data: files, error: filesError } = await sourceClient.storage.from(bucket.name).list('', {
        limit: 1000,
        offset: 0,
      });
      
      if (filesError) {
        log(`    ⚠️  Error listing files: ${filesError.message}`, 'yellow');
        continue;
      }
      
      if (!files || files.length === 0) {
        log(`    ℹ️  No files in bucket ${bucket.name}`, 'yellow');
        continue;
      }
      
      log(`    📁 Found ${files.length} files/folders`, 'blue');
      
      // Download and upload each file
      for (const file of files) {
        if (file.id === null) continue; // Skip folders
        
        try {
          const { data: fileData, error: downloadError } = await sourceClient.storage
            .from(bucket.name)
            .download(file.name);
          
          if (downloadError) {
            log(`      ⚠️  Error downloading ${file.name}: ${downloadError.message}`, 'red');
            continue;
          }
          
          const { error: uploadError } = await destClient.storage
            .from(bucket.name)
            .upload(file.name, fileData, {
              contentType: file.metadata?.mimetype,
              upsert: true,
            });
          
          if (uploadError) {
            log(`      ⚠️  Error uploading ${file.name}: ${uploadError.message}`, 'red');
          } else {
            log(`      ✓ Migrated file: ${file.name}`, 'green');
          }
        } catch (err) {
          log(`      ⚠️  Error with file ${file.name}: ${err.message}`, 'red');
        }
      }
    }
    
    return { success: true };
    
  } catch (error) {
    log(`  ⚠️  Storage migration error: ${error.message}`, 'red');
    return { success: false };
  }
}

// Predefined table schemas for tables that might be empty
const PREDEFINED_SCHEMAS = {
  'pr_bundles': `CREATE TABLE IF NOT EXISTS "pr_bundles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "category" TEXT NOT NULL,
  "bundles" JSONB DEFAULT '[]'::jsonb,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`,
  'others': `CREATE TABLE IF NOT EXISTS "others" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "category" TEXT NOT NULL,
  "items" JSONB DEFAULT '[]'::jsonb,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`,
  'broadcast_messages': `CREATE TABLE IF NOT EXISTS "broadcast_messages" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "created_by" UUID NOT NULL,
  "send_to_all" BOOLEAN DEFAULT false,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`,
  'broadcast_message_recipients': `CREATE TABLE IF NOT EXISTS "broadcast_message_recipients" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "message_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "is_read" BOOLEAN DEFAULT false,
  "is_closed" BOOLEAN DEFAULT false,
  "read_at" TIMESTAMP WITH TIME ZONE,
  "closed_at" TIMESTAMP WITH TIME ZONE,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);`,
  'user_profiles': `CREATE TABLE IF NOT EXISTS "user_profiles" (
  "id" UUID PRIMARY KEY,
  "email" TEXT NOT NULL,
  "full_name" TEXT,
  "role" TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  "brand_name" TEXT,
  "brand_logo" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(email)
);`,
  'user_price_adjustments': `CREATE TABLE IF NOT EXISTS "user_price_adjustments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "table_name" TEXT NOT NULL,
  "adjustment_percentage" NUMERIC,
  "min_price" NUMERIC,
  "max_price" NUMERIC,
  "exact_amount" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`,
  'global_price_adjustments': `CREATE TABLE IF NOT EXISTS "global_price_adjustments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "table_name" TEXT NOT NULL,
  "adjustment_percentage" NUMERIC,
  "min_price" NUMERIC,
  "max_price" NUMERIC,
  "exact_amount" TEXT,
  "applied_by" UUID,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(table_name)
);`,
  'tab_visibility': `CREATE TABLE IF NOT EXISTS "tab_visibility" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tab_id" UUID,
  "tab_name" TEXT NOT NULL,
  "is_visible" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`,
  'admin_settings': `CREATE TABLE IF NOT EXISTS "admin_settings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "setting_key" TEXT NOT NULL,
  "setting_value" TEXT,
  "updated_by" UUID,
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(setting_key)
);`,
  'publications': `CREATE TABLE IF NOT EXISTS "publications" (
  "_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT NOT NULL,
  "logo" JSONB,
  "genres" JSONB DEFAULT '[]'::jsonb,
  "default_price" JSONB DEFAULT '[]'::jsonb,
  "custom_price" TEXT,
  "domain_authority" NUMERIC,
  "domain_rating" NUMERIC,
  "estimated_time" TEXT,
  "regions" JSONB DEFAULT '[]'::jsonb,
  "sponsored" TEXT,
  "indexed" TEXT,
  "do_follow" TEXT,
  "article_preview" JSONB,
  "image" TEXT,
  "url" TEXT,
  "health" BOOLEAN,
  "health_multiplier" TEXT,
  "cbd" BOOLEAN,
  "cbd_multiplier" TEXT,
  "crypto" BOOLEAN,
  "crypto_multiplier" TEXT,
  "gambling" BOOLEAN,
  "gambling_multiplier" TEXT,
  "erotic" BOOLEAN,
  "erotic_multiplier" TEXT,
  "erotic_price" TEXT,
  "badges" JSONB DEFAULT '[]'::jsonb,
  "business" TEXT,
  "is_presale" TEXT,
  "listicles" TEXT,
  "more_info" TEXT,
  "sale_expire_date" TEXT,
  "sale_price" TEXT,
  "show_on_sale" TEXT,
  "slug" TEXT,
  "img_explain" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`,
  'social_posts': `CREATE TABLE IF NOT EXISTS "social_posts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "publication" TEXT NOT NULL,
  "image" TEXT,
  "url" TEXT,
  "platforms" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "price" TEXT,
  "tat" TEXT,
  "example_url" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`,
  'digital_tv': `CREATE TABLE IF NOT EXISTS "digital_tv" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "call_sign" TEXT,
  "station" TEXT NOT NULL,
  "rate" TEXT,
  "tat" TEXT,
  "sponsored" TEXT,
  "indexed" TEXT,
  "segment_length" TEXT,
  "location" TEXT,
  "program_name" TEXT,
  "interview_type" TEXT,
  "example_url" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`,
  'best_sellers': `CREATE TABLE IF NOT EXISTS "best_sellers" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "publication" TEXT NOT NULL,
  "image" TEXT,
  "genres" TEXT,
  "price" TEXT,
  "da" TEXT,
  "dr" TEXT,
  "tat" TEXT,
  "region" TEXT,
  "sponsored" TEXT,
  "indexed" TEXT,
  "dofollow" TEXT,
  "example_url" TEXT,
  "has_image" TEXT,
  "niches" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`,
  'listicles': `CREATE TABLE IF NOT EXISTS "listicles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "publication" TEXT NOT NULL,
  "image" TEXT,
  "genres" TEXT,
  "price" TEXT,
  "da" TEXT,
  "dr" TEXT,
  "tat" TEXT,
  "region" TEXT,
  "sponsored" TEXT,
  "indexed" TEXT,
  "dofollow" TEXT,
  "example_url" TEXT,
  "has_image" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`,
  'print': `CREATE TABLE IF NOT EXISTS "print" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "category" TEXT NOT NULL,
  "magazines" JSONB DEFAULT '[]'::jsonb,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`,
  'broadcast_tv': `CREATE TABLE IF NOT EXISTS "broadcast_tv" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "affiliate" TEXT,
  "calls" TEXT,
  "state" TEXT,
  "market" TEXT,
  "program" TEXT,
  "location" TEXT,
  "time" TEXT,
  "rate" TEXT,
  "example_url" TEXT,
  "intake_url" TEXT,
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);`
};

// Function to get table column info from source by fetching one row
async function getTableColumns(tableName) {
  const { data, error } = await sourceClient
    .from(tableName)
    .select('*')
    .limit(1);
  
  if (error) {
    return null;
  }
  
  if (data && data.length > 0) {
    return Object.keys(data[0]);
  }
  
  return null;
}

// Function to infer SQL type from JS value
function inferSQLType(value, columnName) {
  if (columnName === 'id' || columnName === '_id') {
    return 'UUID PRIMARY KEY DEFAULT gen_random_uuid()';
  }
  if (columnName.endsWith('_id') || columnName === 'user_id' || columnName === 'created_by') {
    return 'UUID';
  }
  if (columnName === 'created_at' || columnName === 'updated_at' || columnName.endsWith('_at')) {
    return 'TIMESTAMP WITH TIME ZONE DEFAULT NOW()';
  }
  
  if (value === null) {
    return 'TEXT';
  }
  
  const type = typeof value;
  
  if (type === 'boolean') {
    return 'BOOLEAN DEFAULT false';
  }
  if (type === 'number') {
    if (Number.isInteger(value)) {
      return 'INTEGER';
    }
    return 'NUMERIC';
  }
  if (type === 'object') {
    if (Array.isArray(value)) {
      return "JSONB DEFAULT '[]'::jsonb";
    }
    return "JSONB DEFAULT '{}'::jsonb";
  }
  
  return 'TEXT';
}

// Generate CREATE TABLE SQL from sample data
function generateCreateTableSQL(tableName, sampleRow) {
  if (!sampleRow) {
    return null;
  }
  
  const columns = Object.entries(sampleRow).map(([col, val]) => {
    const sqlType = inferSQLType(val, col);
    return `  "${col}" ${sqlType}`;
  });
  
  return `CREATE TABLE IF NOT EXISTS "${tableName}" (\n${columns.join(',\n')}\n);`;
}

// Create table in destination using Supabase Management API
async function createTableInDestination(tableName, createSQL) {
  log(`  🔨 Creating table "${tableName}"...`, 'blue');
  
  // We need to use the Supabase Management API or SQL Editor
  // Since we can't directly execute SQL, we'll use a workaround
  // Try to create via the REST API by using pg_catalog queries
  
  const projectRef = 'fgptzilqznazirjlwydg';
  
  // Unfortunately, we can't execute raw SQL via the REST API
  // We need to output the SQL for manual execution
  log(`    ℹ️  SQL: ${createSQL.substring(0, 100)}...`, 'yellow');
  
  return createSQL;
}

// Generate complete schema SQL
async function generateSchemaSQL() {
  log('\n📋 Generating schema from source database...', 'cyan');
  
  const tables = await getAllTables();
  const schemaSQLs = [];
  
  for (const tableName of tables) {
    try {
      const { data } = await sourceClient
        .from(tableName)
        .select('*')
        .limit(1);
      
      if (data && data.length > 0) {
        const createSQL = generateCreateTableSQL(tableName, data[0]);
        if (createSQL) {
          schemaSQLs.push({ tableName, sql: createSQL });
          log(`  ✓ Generated schema for "${tableName}" (from data)`, 'green');
        }
      } else {
        // Use predefined schema if no data exists
        if (PREDEFINED_SCHEMAS[tableName]) {
          schemaSQLs.push({ tableName, sql: PREDEFINED_SCHEMAS[tableName] });
          log(`  ✓ Generated schema for "${tableName}" (from predefined)`, 'green');
        } else {
          log(`  ⚠️  No data and no predefined schema for "${tableName}"`, 'yellow');
        }
      }
    } catch (err) {
      // Table might not exist, use predefined schema
      if (PREDEFINED_SCHEMAS[tableName]) {
        schemaSQLs.push({ tableName, sql: PREDEFINED_SCHEMAS[tableName] });
        log(`  ✓ Generated schema for "${tableName}" (from predefined - table not found)`, 'green');
      } else {
        log(`  ⚠️  Error generating schema for "${tableName}": ${err.message}`, 'yellow');
      }
    }
  }
  
  return schemaSQLs;
}

// Execute SQL via Supabase's pg_net extension (if available)
async function executeSQLViaRPC(sql) {
  // This requires the pg_net extension to be enabled
  // Alternative: Use Supabase CLI or Management API
  try {
    const response = await fetch(`${DEST_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': DEST_SERVICE_KEY,
        'Authorization': `Bearer ${DEST_SERVICE_KEY}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ sql_query: sql })
    });
    
    return response.ok;
  } catch (err) {
    return false;
  }
}

async function main() {
  console.log('\n' + '='.repeat(60));
  log('🚀 SUPABASE MIGRATION TOOL', 'cyan');
  log(`   Source: ${SOURCE_URL}`, 'blue');
  log(`   Destination: ${DEST_URL}`, 'blue');
  console.log('='.repeat(60));
  
  const startTime = Date.now();
  const results = {
    schemas: [],
    tables: {},
    authUsers: { success: false, count: 0 },
    storage: { success: false },
  };
  
  try {
    // Step 1: Test connections
    log('\n🔌 Testing connections...', 'cyan');
    
    const { error: sourceError } = await sourceClient.from('publications').select('count', { count: 'exact', head: true });
    if (sourceError && !sourceError.message.includes('does not exist')) {
      throw new Error(`Source connection failed: ${sourceError.message}`);
    }
    log('  ✓ Source database connected', 'green');
    
    // Test destination
    try {
      const destTest = await fetch(`${DEST_URL}/rest/v1/`, {
        headers: {
          'apikey': DEST_SERVICE_KEY,
          'Authorization': `Bearer ${DEST_SERVICE_KEY}`,
        }
      });
      if (destTest.ok) {
        log('  ✓ Destination database connected', 'green');
      }
    } catch (e) {
      log('  ⚠️  Destination connection issue', 'yellow');
    }
    
    // Step 2: Generate and output schema SQL
    log('\n' + '='.repeat(60), 'cyan');
    log('📝 STEP 1: SCHEMA GENERATION', 'cyan');
    log('='.repeat(60), 'cyan');
    
    const schemas = await generateSchemaSQL();
    results.schemas = schemas;
    
    // Write schema SQL to file for manual execution
    const fs = require('fs');
    const path = require('path');
    
    let fullSchemaSQL = `-- Auto-generated migration schema
-- Run this in Supabase SQL Editor BEFORE running data migration
-- Generated: ${new Date().toISOString()}

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = user_id AND role = 'admin'
  );
END;
$$;

`;
    
    for (const { tableName, sql } of schemas) {
      fullSchemaSQL += `\n-- Table: ${tableName}\n${sql}\n`;
      fullSchemaSQL += `\n-- Enable RLS\nALTER TABLE "${tableName}" ENABLE ROW LEVEL SECURITY;\n`;
      fullSchemaSQL += `\n-- Allow public access (adjust as needed)\nCREATE POLICY "Allow public read access" ON "${tableName}" FOR SELECT USING (true);\n`;
      fullSchemaSQL += `CREATE POLICY "Allow public insert access" ON "${tableName}" FOR INSERT WITH CHECK (true);\n`;
      fullSchemaSQL += `CREATE POLICY "Allow public update access" ON "${tableName}" FOR UPDATE USING (true);\n`;
      fullSchemaSQL += `CREATE POLICY "Allow public delete access" ON "${tableName}" FOR DELETE USING (true);\n`;
    }
    
    // Add user_profiles table with proper structure
    fullSchemaSQL += `
-- User profiles table (links to auth.users)
CREATE TABLE IF NOT EXISTS "user_profiles" (
  "id" UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  "email" TEXT NOT NULL,
  "full_name" TEXT,
  "role" TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(email)
);

ALTER TABLE "user_profiles" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON user_profiles FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "Admins can insert profiles" ON user_profiles FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins can update profiles" ON user_profiles FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "Service role full access" ON user_profiles FOR ALL USING (true);
`;
    
    const schemaFilePath = path.join(__dirname, 'generated-migration-schema.sql');
    fs.writeFileSync(schemaFilePath, fullSchemaSQL);
    log(`\n✓ Schema SQL written to: ${schemaFilePath}`, 'green');
    log('\n⚠️  IMPORTANT: Run this SQL in Supabase SQL Editor first!', 'yellow');
    log('   1. Go to: https://supabase.com/dashboard/project/fgptzilqznazirjlwydg/sql', 'yellow');
    log('   2. Copy and paste the contents of generated-migration-schema.sql', 'yellow');
    log('   3. Click "Run" to create all tables', 'yellow');
    log('   4. Then run this script again with --migrate-data flag', 'yellow');
    
    // Check if --migrate-data flag is provided
    const shouldMigrateData = process.argv.includes('--migrate-data');
    
    if (!shouldMigrateData) {
      console.log('\n' + '='.repeat(60));
      log('📋 SCHEMA GENERATED - RUN WITH --migrate-data TO CONTINUE', 'cyan');
      console.log('='.repeat(60));
      log('\nTo migrate data after creating tables, run:', 'blue');
      log('   node scripts/migrate-supabase.js --migrate-data', 'green');
      return;
    }
    
    // Step 3: Migrate Auth Users first (they may be referenced by other tables)
    log('\n' + '='.repeat(60), 'cyan');
    log('📝 STEP 2: AUTH USER MIGRATION', 'cyan');
    log('='.repeat(60), 'cyan');
    
    results.authUsers = await migrateAuthUsers();
    
    // Step 4: Get all tables and migrate data
    log('\n' + '='.repeat(60), 'cyan');
    log('📝 STEP 3: DATA MIGRATION', 'cyan');
    log('='.repeat(60), 'cyan');
    
    const tables = await getAllTables();
    log(`\n📊 Migrating ${tables.length} tables...`, 'cyan');
    
    // Migrate each table
    for (const tableName of tables) {
      try {
        const { data } = await getTableData(tableName);
        const result = await insertTableData(tableName, data);
        results.tables[tableName] = result;
      } catch (err) {
        log(`  ⚠️  Table ${tableName} error: ${err.message}`, 'red');
        results.tables[tableName] = { success: false, error: err.message };
      }
    }
    
    // Step 5: Migrate Storage
    log('\n' + '='.repeat(60), 'cyan');
    log('📝 STEP 4: STORAGE MIGRATION', 'cyan');
    log('='.repeat(60), 'cyan');
    
    results.storage = await migrateStorage();
    
    // Summary
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('\n' + '='.repeat(60));
    log('📊 MIGRATION SUMMARY', 'cyan');
    console.log('='.repeat(60));
    
    log(`\n⏱️  Duration: ${duration} seconds`, 'blue');
    
    log('\n👥 Auth Users:', 'cyan');
    log(`   ${results.authUsers.success ? '✓' : '⚠️'} ${results.authUsers.count} users migrated`, 
      results.authUsers.success ? 'green' : 'yellow');
    
    log('\n📋 Tables:', 'cyan');
    for (const [table, result] of Object.entries(results.tables)) {
      const icon = result.success ? '✓' : '⚠️';
      const color = result.success ? 'green' : 'yellow';
      log(`   ${icon} ${table}: ${result.count || 0} rows`, color);
    }
    
    log('\n📦 Storage:', 'cyan');
    log(`   ${results.storage.success ? '✓' : '⚠️'} Storage migration ${results.storage.success ? 'completed' : 'had issues'}`,
      results.storage.success ? 'green' : 'yellow');
    
    console.log('\n' + '='.repeat(60));
    log('✅ MIGRATION COMPLETE!', 'green');
    console.log('='.repeat(60));
    
    log('\n⚠️  IMPORTANT NOTES:', 'yellow');
    log('   1. Auth user passwords could not be migrated - users will need to reset passwords', 'yellow');
    log('   2. Update your .env.local to use Supabase 2 credentials', 'yellow');
    
  } catch (error) {
    log(`\n❌ Migration failed: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run the migration
main().catch(console.error);
