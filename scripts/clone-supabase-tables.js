const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Source Supabase (Credentials 1)
const SOURCE_URL = 'https://sejgcgatlggiznkcimvz.supabase.co'
const SOURCE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlamdjZ2F0bGdnaXpua2NpbXZ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYzMjg5OCwiZXhwIjoyMDc4MjA4ODk4fQ.4qS1aIp3ynSxk8b-TWx4EELKzNeWHa5Abfcec3CnbHM'

// Destination Supabase (Credentials 2)
const DEST_URL = 'https://fzorirzobvypsachtwkx.supabase.co'
const DEST_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ6b3JpcnpvYnZ5cHNhY2h0d2t4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mjk1ODM4NCwiZXhwIjoyMDc4NTM0Mzg0fQ.k0GX7-GARsz80MdyBxw5alASDd7W9_aWdPANXuJQgN8'

// Create clients with service role keys for full access
const sourceClient = createClient(SOURCE_URL, SOURCE_SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
})

const destClient = createClient(DEST_URL, DEST_SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
})

// Common tables to check (add more as needed)
const COMMON_TABLES = [
  'publications',
  'social_posts',
  'digital_tv',
  'best_sellers',
  'listicles',
  'pr_bundles',
  'print',
  'broadcast_tv',
  'profiles',
  'global_price_adjustments',
  'user_price_adjustments'
]

// Helper function to log progress
function logProgress(message, type = 'info') {
  const icons = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warning: '⚠️'
  }
  const timestamp = new Date().toLocaleTimeString()
  console.log(`[${timestamp}] ${icons[type] || 'ℹ️'} ${message}`)
}

// Get all table names from source by testing common tables
async function getTableNames() {
  try {
    logProgress('Discovering tables in source database...', 'info')
    
    const existingTables = []
    
    // Test each common table to see if it exists
    for (const tableName of COMMON_TABLES) {
      try {
        const { error } = await sourceClient.from(tableName).select('*').limit(1)
        if (!error) {
          existingTables.push(tableName)
          logProgress(`Found table: ${tableName}`, 'success')
        }
      } catch (err) {
        // Table doesn't exist or not accessible, skip it
      }
    }
    
    // Also try to get all tables via REST API metadata endpoint
    try {
      const response = await fetch(`${SOURCE_URL}/rest/v1/`, {
        headers: {
          'apikey': SOURCE_SERVICE_KEY,
          'Authorization': `Bearer ${SOURCE_SERVICE_KEY}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        // The response might contain table information
        // This is a fallback method
      }
    } catch (err) {
      // Ignore errors from metadata endpoint
    }
    
    if (existingTables.length === 0) {
      logProgress('No tables found. Using common table list as fallback.', 'warning')
      return COMMON_TABLES
    }
    
    return existingTables
  } catch (error) {
    logProgress(`Error discovering tables: ${error.message}`, 'error')
    logProgress('Using common table list as fallback.', 'warning')
    return COMMON_TABLES
  }
}

// Check if table exists in destination
async function checkTableExists(tableName) {
  try {
    const { error } = await destClient.from(tableName).select('*').limit(1)
    return !error
  } catch {
    return false
  }
}

// Ensure exec_sql function exists in destination
async function ensureExecSqlFunction() {
  try {
    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION exec_sql(sql_text text)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        EXECUTE sql_text;
      END;
      $$;
    `

    const response = await fetch(`${DEST_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': DEST_SERVICE_KEY,
        'Authorization': `Bearer ${DEST_SERVICE_KEY}`
      },
      body: JSON.stringify({
        sql: createFunctionSQL
      })
    })

    // If function doesn't exist, try to create it via direct SQL
    if (!response.ok) {
      // Use Supabase Management API or direct connection would be needed
      // For now, we'll try to create it via a workaround
      logProgress('Note: exec_sql function may need to be created manually', 'info')
    }
  } catch (error) {
    // Ignore - function might already exist or we'll use alternative methods
  }
}

// Get table schema from source - try multiple methods
async function getTableSchema(tableName) {
  try {
    logProgress(`Fetching schema for ${tableName}...`, 'info')
    
    // Method 1: Try RPC exec_sql
    try {
      const response = await fetch(`${SOURCE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SOURCE_SERVICE_KEY,
          'Authorization': `Bearer ${SOURCE_SERVICE_KEY}`
        },
        body: JSON.stringify({
          sql: `
            SELECT 
              column_name,
              data_type,
              is_nullable,
              column_default,
              character_maximum_length,
              numeric_precision,
              numeric_scale,
              udt_name
            FROM information_schema.columns
            WHERE table_schema = 'public' 
            AND table_name = '${tableName}'
            ORDER BY ordinal_position;
          `
        })
      })

      if (response.ok) {
        const data = await response.json()
        if (data && data.length > 0) {
          return data
        }
      }
    } catch (err) {
      // RPC method failed, try alternative
    }

    // Method 2: Infer from sample data
    return await getTableSchemaAlternative(tableName)
  } catch (error) {
    logProgress(`Error fetching schema: ${error.message}`, 'warning')
    return await getTableSchemaAlternative(tableName)
  }
}

// Alternative method to get schema by querying a sample row
async function getTableSchemaAlternative(tableName) {
  try {
    // Get a sample row to infer schema
    const { data, error } = await sourceClient.from(tableName).select('*').limit(1)
    
    if (error || !data || data.length === 0) {
      logProgress(`Could not infer schema for ${tableName}`, 'warning')
      return null
    }

    // Infer schema from the first row
    const sampleRow = data[0]
    const columns = []
    
    for (const [key, value] of Object.entries(sampleRow)) {
      let dataType = 'TEXT'
      let nullable = true
      
      if (value === null) {
        nullable = true
        dataType = 'TEXT' // Default type
      } else if (typeof value === 'string') {
        dataType = 'TEXT'
      } else if (typeof value === 'number') {
        if (Number.isInteger(value)) {
          dataType = 'BIGINT'
        } else {
          dataType = 'DOUBLE PRECISION'
        }
      } else if (typeof value === 'boolean') {
        dataType = 'BOOLEAN'
      } else if (value instanceof Date) {
        dataType = 'TIMESTAMP WITH TIME ZONE'
      } else if (typeof value === 'object') {
        dataType = 'JSONB'
      }
      
      columns.push({
        column_name: key,
        data_type: dataType,
        is_nullable: nullable ? 'YES' : 'NO',
        column_default: null,
        character_maximum_length: null,
        numeric_precision: null,
        numeric_scale: null
      })
    }
    
    return columns
  } catch (error) {
    logProgress(`Error inferring schema for ${tableName}: ${error.message}`, 'error')
    return null
  }
}

// Get primary key information
async function getPrimaryKey(tableName) {
  try {
    const response = await fetch(`${SOURCE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SOURCE_SERVICE_KEY,
        'Authorization': `Bearer ${SOURCE_SERVICE_KEY}`
      },
      body: JSON.stringify({
        sql: `
          SELECT a.attname
          FROM pg_index i
          JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
          WHERE i.indrelid = '${tableName}'::regclass
          AND i.indisprimary;
        `
      })
    })

    if (response.ok) {
      const data = await response.json()
      return data?.map(row => row.attname) || []
    }
    return []
  } catch {
    return []
  }
}

// Create table in destination using direct SQL execution
async function createTableInDestination(tableName, schema, primaryKeys = []) {
  try {
    if (!schema || schema.length === 0) {
      logProgress(`No schema available for ${tableName}`, 'error')
      return false
    }

    logProgress(`Creating table ${tableName} in destination...`, 'info')

    // Build column definitions
    const columns = schema.map(col => {
      let colDef = `"${col.column_name}" `
      
      // Map data types
      let dataType = col.data_type
      if (col.udt_name) {
        // Use UDT name for more accurate type mapping
        switch (col.udt_name) {
          case 'varchar':
            dataType = col.character_maximum_length ? `VARCHAR(${col.character_maximum_length})` : 'TEXT'
            break
          case 'text':
            dataType = 'TEXT'
            break
          case 'int4':
            dataType = 'INTEGER'
            break
          case 'int8':
            dataType = 'BIGINT'
            break
          case 'numeric':
            dataType = `NUMERIC(${col.numeric_precision || 10}, ${col.numeric_scale || 2})`
            break
          case 'float8':
            dataType = 'DOUBLE PRECISION'
            break
          case 'bool':
            dataType = 'BOOLEAN'
            break
          case 'timestamptz':
            dataType = 'TIMESTAMP WITH TIME ZONE'
            break
          case 'timestamp':
            dataType = 'TIMESTAMP WITHOUT TIME ZONE'
            break
          case 'date':
            dataType = 'DATE'
            break
          case 'jsonb':
            dataType = 'JSONB'
            break
          case 'json':
            dataType = 'JSON'
            break
          case 'uuid':
            dataType = 'UUID'
            break
          default:
            dataType = col.data_type || col.udt_name
        }
      } else {
        // Fallback to data_type
        switch (col.data_type) {
          case 'character varying':
            dataType = col.character_maximum_length ? `VARCHAR(${col.character_maximum_length})` : 'TEXT'
            break
          case 'text':
            dataType = 'TEXT'
            break
          case 'integer':
            dataType = 'INTEGER'
            break
          case 'bigint':
            dataType = 'BIGINT'
            break
          case 'numeric':
          case 'decimal':
            dataType = `NUMERIC(${col.numeric_precision || 10}, ${col.numeric_scale || 2})`
            break
          case 'double precision':
            dataType = 'DOUBLE PRECISION'
            break
          case 'boolean':
            dataType = 'BOOLEAN'
            break
          case 'timestamp with time zone':
            dataType = 'TIMESTAMP WITH TIME ZONE'
            break
          case 'timestamp without time zone':
            dataType = 'TIMESTAMP WITHOUT TIME ZONE'
            break
          case 'date':
            dataType = 'DATE'
            break
          case 'jsonb':
            dataType = 'JSONB'
            break
          case 'json':
            dataType = 'JSON'
            break
          case 'uuid':
            dataType = 'UUID'
            break
          default:
            dataType = col.data_type.toUpperCase()
        }
      }
      
      colDef += dataType
      
      if (col.is_nullable === 'NO') {
        colDef += ' NOT NULL'
      }
      
      if (col.column_default && !col.column_default.includes('nextval') && !col.column_default.includes('gen_random_uuid')) {
        // Skip sequence and function defaults
        colDef += ` DEFAULT ${col.column_default}`
      }
      
      return colDef
    }).join(', ')

    // Build CREATE TABLE SQL
    let createTableSQL = `CREATE TABLE IF NOT EXISTS "${tableName}" (${columns}`
    
    // Add primary key if exists
    if (primaryKeys.length > 0) {
      const pkColumns = primaryKeys.map(pk => `"${pk}"`).join(', ')
      createTableSQL += `, PRIMARY KEY (${pkColumns})`
    }
    
    createTableSQL += ');'

    // Try to execute SQL using RPC
    try {
      const response = await fetch(`${DEST_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': DEST_SERVICE_KEY,
          'Authorization': `Bearer ${DEST_SERVICE_KEY}`
        },
        body: JSON.stringify({
          sql: createTableSQL
        })
      })

      if (response.ok) {
        logProgress(`Created table ${tableName} in destination`, 'success')
        return true
      }

      // Check if table already exists
      const exists = await checkTableExists(tableName)
      if (exists) {
        logProgress(`Table ${tableName} already exists in destination`, 'info')
        return true
      }
      
      const errorText = await response.text()
      logProgress(`Could not create table via RPC: ${errorText}`, 'warning')
    } catch (rpcError) {
      logProgress(`RPC method failed: ${rpcError.message}`, 'warning')
    }

    // Fallback: Save SQL to file
    const sqlFilePath = path.join(__dirname, 'create-tables-manual.sql')
    const sqlContent = `-- Table: ${tableName}\n${createTableSQL}\n\n`
    
    // Append to file
    if (fs.existsSync(sqlFilePath)) {
      fs.appendFileSync(sqlFilePath, sqlContent, 'utf8')
    } else {
      const header = `-- SQL to create tables in destination database\n-- Generated: ${new Date().toISOString()}\n-- Source: ${SOURCE_URL}\n-- Destination: ${DEST_URL}\n\n-- First, create exec_sql function:\nCREATE OR REPLACE FUNCTION exec_sql(sql_text text)\nRETURNS void\nLANGUAGE plpgsql\nSECURITY DEFINER\nAS $$\nBEGIN\n  EXECUTE sql_text;\nEND;\n$$;\n\n-- Then create tables:\n\n`
      fs.writeFileSync(sqlFilePath, header + sqlContent, 'utf8')
    }
    
    logProgress(`⚠️  Could not create table ${tableName} automatically.`, 'warning')
    logProgress(`   SQL saved to: ${sqlFilePath}`, 'info')
    logProgress(`   Please run the SQL file in your Supabase SQL Editor`, 'info')
    
    return false
  } catch (error) {
    logProgress(`Error creating table ${tableName}: ${error.message}`, 'error')
    return false
  }
}

// Fetch all data from a table
async function fetchTableData(tableName) {
  try {
    logProgress(`Fetching data from ${tableName}...`, 'info')
    
    let allData = []
    let page = 0
    const pageSize = 1000
    let hasMore = true

    while (hasMore) {
      const { data, error } = await sourceClient
        .from(tableName)
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1)

      if (error) {
        logProgress(`Error fetching data from ${tableName}: ${error.message}`, 'error')
        break
      }

      if (!data || data.length === 0) {
        hasMore = false
      } else {
        allData = allData.concat(data)
        logProgress(`Fetched ${allData.length} records from ${tableName}...`, 'info')
        
        if (data.length < pageSize) {
          hasMore = false
        } else {
          page++
        }
      }
    }

    return allData
  } catch (error) {
    logProgress(`Error fetching data from ${tableName}: ${error.message}`, 'error')
    return []
  }
}

// Insert data into destination table
async function insertTableData(tableName, data) {
  try {
    if (!data || data.length === 0) {
      logProgress(`No data to insert for ${tableName}`, 'info')
      return { success: 0, failed: 0 }
    }

    logProgress(`Inserting ${data.length} records into ${tableName}...`, 'info')

    // Insert in batches to avoid timeout
    const batchSize = 100
    let successCount = 0
    let failedCount = 0

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize)
      
      const { error } = await destClient
        .from(tableName)
        .upsert(batch, { onConflict: 'id' })

      if (error) {
        logProgress(`Error inserting batch into ${tableName}: ${error.message}`, 'error')
        failedCount += batch.length
      } else {
        successCount += batch.length
        if (successCount % 500 === 0) {
          logProgress(`Inserted ${successCount}/${data.length} records into ${tableName}...`, 'info')
        }
      }
    }

    logProgress(`Completed ${tableName}: ${successCount} succeeded, ${failedCount} failed`, 
      failedCount > 0 ? 'warning' : 'success')
    
    return { success: successCount, failed: failedCount }
  } catch (error) {
    logProgress(`Error inserting data into ${tableName}: ${error.message}`, 'error')
    return { success: 0, failed: data.length }
  }
}

// Clone a single table
async function cloneTable(tableName) {
  try {
    logProgress(`\n${'='.repeat(60)}`, 'info')
    logProgress(`Cloning table: ${tableName}`, 'info')
    logProgress(`${'='.repeat(60)}`, 'info')

    // Step 1: Check if table exists in destination
    let tableExists = await checkTableExists(tableName)
    
    // Step 2: If table doesn't exist, create it
    if (!tableExists) {
      logProgress(`Table ${tableName} does not exist in destination, creating...`, 'info')
      
      // Get schema from source
      const schema = await getTableSchema(tableName)
      if (!schema || schema.length === 0) {
        logProgress(`Could not get schema for ${tableName}, skipping...`, 'error')
        return { success: false, records: 0, skipped: true }
      }
      
      // Get primary keys
      const primaryKeys = await getPrimaryKey(tableName)
      
      // Create table in destination
      const created = await createTableInDestination(tableName, schema, primaryKeys)
      if (!created) {
        logProgress(`Failed to create table ${tableName}, skipping...`, 'error')
        return { success: false, records: 0, skipped: true }
      }
      
      tableExists = true
    } else {
      logProgress(`Table ${tableName} already exists in destination`, 'info')
    }

    // Step 3: Fetch data from source
    const data = await fetchTableData(tableName)
    
    if (data.length === 0) {
      logProgress(`No data found in ${tableName}`, 'info')
      return { success: true, records: 0 }
    }

    // Step 4: Insert data into destination
    const result = await insertTableData(tableName, data)
    
    return { 
      success: result.failed === 0, 
      records: result.success 
    }
  } catch (error) {
    logProgress(`Error cloning table ${tableName}: ${error.message}`, 'error')
    return { success: false, records: 0 }
  }
}

// Main function
async function cloneAllTables() {
  try {
    logProgress('🚀 Starting Supabase Table Cloning Process...', 'info')
    logProgress(`Source: ${SOURCE_URL}`, 'info')
    logProgress(`Destination: ${DEST_URL}`, 'info')
    console.log('')

    // Ensure exec_sql function exists in destination
    await ensureExecSqlFunction()
    console.log('')

    // Get all table names
    const tableNames = await getTableNames()
    
    if (tableNames.length === 0) {
      logProgress('No tables found in source database', 'error')
      return
    }

    logProgress(`Found ${tableNames.length} tables to clone: ${tableNames.join(', ')}`, 'info')
    console.log('')

    const results = []
    
    // Clone each table
    for (const tableName of tableNames) {
      const result = await cloneTable(tableName)
      results.push({ table: tableName, ...result })
    }

    // Summary
    console.log('')
    logProgress(`${'='.repeat(60)}`, 'info')
    logProgress('📊 Cloning Summary', 'info')
    logProgress(`${'='.repeat(60)}`, 'info')
    
    let totalRecords = 0
    let successCount = 0
    
    results.forEach(result => {
      if (result.skipped) {
        logProgress(`⏭️  ${result.table}: SKIPPED (table doesn't exist in destination)`, 'warning')
      } else {
        const status = result.success ? '✅' : '❌'
        logProgress(`${status} ${result.table}: ${result.records} records`, 
          result.success ? 'success' : 'error')
        totalRecords += result.records
        if (result.success) successCount++
      }
    })
    
    console.log('')
    logProgress(`Total: ${successCount}/${results.length} tables cloned successfully`, 
      successCount === results.length ? 'success' : 'warning')
    logProgress(`Total records migrated: ${totalRecords}`, 'info')
    
    // Check if SQL file was created
    const sqlFilePath = path.join(__dirname, 'create-tables-manual.sql')
    if (fs.existsSync(sqlFilePath)) {
      console.log('')
      logProgress('📄 SQL file generated: create-tables-manual.sql', 'info')
      logProgress('   Run this SQL in your destination Supabase SQL Editor first', 'info')
      logProgress('   Then run this script again to copy the data', 'info')
    }
    
    logProgress('✨ Cloning process completed!', 'success')
    
  } catch (error) {
    logProgress(`Fatal error: ${error.message}`, 'error')
    console.error(error)
  }
}

// Run the cloning process
cloneAllTables().catch(console.error)

