const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Source Supabase (Credentials 1)
const SOURCE_URL = 'https://sejgcgatlggiznkcimvz.supabase.co'
const SOURCE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlamdjZ2F0bGdnaXpua2NpbXZ6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYzMjg5OCwiZXhwIjoyMDc4MjA4ODk4fQ.4qS1aIp3ynSxk8b-TWx4EELKzNeWHa5Abfcec3CnbHM'

const sourceClient = createClient(SOURCE_URL, SOURCE_SERVICE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
})

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

function logProgress(message, type = 'info') {
  const icons = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warning: '⚠️'
  }
  console.log(`${icons[type] || 'ℹ️'} ${message}`)
}

// Get table names
async function getTableNames() {
  const existingTables = []
  for (const tableName of COMMON_TABLES) {
    try {
      const { error } = await sourceClient.from(tableName).select('*').limit(1)
      if (!error) {
        existingTables.push(tableName)
      }
    } catch (err) {
      // Skip
    }
  }
  return existingTables.length > 0 ? existingTables : COMMON_TABLES
}

// Get schema by inferring from sample data
async function getTableSchema(tableName) {
  try {
    const { data, error } = await sourceClient.from(tableName).select('*').limit(1)
    
    if (error || !data || data.length === 0) {
      return null
    }

    const sampleRow = data[0]
    const columns = []
    
    for (const [key, value] of Object.entries(sampleRow)) {
      let dataType = 'TEXT'
      let nullable = true
      
      if (value === null) {
        nullable = true
        dataType = 'TEXT'
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
        is_nullable: nullable ? 'YES' : 'NO'
      })
    }
    
    return columns
  } catch (error) {
    return null
  }
}

// Get primary key (try to infer from common patterns)
async function getPrimaryKey(tableName) {
  // Common primary key patterns
  const commonPKs = {
    'publications': ['_id'],
    'social_posts': ['id'],
    'digital_tv': ['id'],
    'best_sellers': ['id'],
    'listicles': ['id'],
    'pr_bundles': ['id'],
    'print': ['id'],
    'broadcast_tv': ['id'],
    'global_price_adjustments': ['id'],
    'user_price_adjustments': ['id'],
    'profiles': ['id']
  }
  
  return commonPKs[tableName] || []
}

// Generate CREATE TABLE SQL
function generateCreateTableSQL(tableName, schema, primaryKeys = []) {
  if (!schema || schema.length === 0) {
    return null
  }

  const columns = schema.map(col => {
    let colDef = `"${col.column_name}" ${col.data_type}`
    
    if (col.is_nullable === 'NO') {
      colDef += ' NOT NULL'
    }
    
    return colDef
  }).join(', ')

  let sql = `CREATE TABLE IF NOT EXISTS "${tableName}" (${columns}`
  
  if (primaryKeys.length > 0) {
    const pkColumns = primaryKeys.map(pk => `"${pk}"`).join(', ')
    sql += `, PRIMARY KEY (${pkColumns})`
  }
  
  sql += ');'
  
  return sql
}

// Main function
async function generateSchemas() {
  try {
    logProgress('🚀 Generating table schemas from source database...', 'info')
    console.log('')

    const tableNames = await getTableNames()
    logProgress(`Found ${tableNames.length} tables`, 'info')
    console.log('')

    const sqlStatements = []
    sqlStatements.push('-- Generated table schemas from source Supabase database')
    sqlStatements.push('-- Run this SQL in your destination Supabase SQL Editor')
    sqlStatements.push('-- Source: ' + SOURCE_URL)
    sqlStatements.push('-- Generated: ' + new Date().toISOString())
    sqlStatements.push('')
    sqlStatements.push('-- First, create the exec_sql function (if needed)')
    sqlStatements.push('CREATE OR REPLACE FUNCTION exec_sql(sql_text text)')
    sqlStatements.push('RETURNS void')
    sqlStatements.push('LANGUAGE plpgsql')
    sqlStatements.push('SECURITY DEFINER')
    sqlStatements.push('AS $$')
    sqlStatements.push('BEGIN')
    sqlStatements.push('  EXECUTE sql_text;')
    sqlStatements.push('END;')
    sqlStatements.push('$$;')
    sqlStatements.push('')
    sqlStatements.push('-- Now create all tables:')
    sqlStatements.push('')

    for (const tableName of tableNames) {
      logProgress(`Processing ${tableName}...`, 'info')
      
      const schema = await getTableSchema(tableName)
      if (!schema) {
        logProgress(`  ⚠️  Could not get schema for ${tableName}`, 'warning')
        continue
      }

      const primaryKeys = await getPrimaryKey(tableName)
      const sql = generateCreateTableSQL(tableName, schema, primaryKeys)
      
      if (sql) {
        sqlStatements.push(`-- Table: ${tableName}`)
        sqlStatements.push(sql)
        sqlStatements.push('')
        logProgress(`  ✅ Generated schema for ${tableName}`, 'success')
      }
    }

    // Write to file
    const outputPath = path.join(__dirname, 'generated-table-schemas.sql')
    fs.writeFileSync(outputPath, sqlStatements.join('\n'), 'utf8')

    console.log('')
    logProgress(`✅ Generated SQL file: ${outputPath}`, 'success')
    logProgress('📋 Next steps:', 'info')
    logProgress('   1. Open your destination Supabase project SQL Editor', 'info')
    logProgress('   2. Copy and paste the contents of generated-table-schemas.sql', 'info')
    logProgress('   3. Run the SQL to create all tables', 'info')
    logProgress('   4. Then run: yarn clone:tables', 'info')
    console.log('')

  } catch (error) {
    logProgress(`Error: ${error.message}`, 'error')
    console.error(error)
  }
}

generateSchemas().catch(console.error)

