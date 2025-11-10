# Supabase Migration Scripts

## Quick Start

### 1. Setup Schema (One-time setup)

**Option A: Automatic (Recommended)**
```bash
# First, create the helper function in Supabase SQL Editor
# Run: scripts/create-helper-function.sql

# Then run the automatic setup
yarn setup:schema:auto
```

**Option B: Manual**
```bash
# Copy the SQL from scripts/schema.sql
# Paste it into Supabase SQL Editor and run it
```

### 2. Migrate Data

**Migrate All Tables:**
```bash
yarn migrate:all
```

**Migrate Individual Tables:**
```bash
yarn migrate:publications
yarn migrate:social-posts
yarn migrate:digital-tv
yarn migrate:best-sellers
yarn migrate:listicles
yarn migrate:pr-bundles
yarn migrate:print
yarn migrate:broadcast-tv
```

**Retry Failed Publications:**
```bash
yarn migrate:retry-failed
```

## Scripts Overview

### Schema Setup
- **`setup-supabase-schema.js`** - Generates SQL file and provides instructions
- **`setup-schema-auto.js`** - Attempts automatic schema setup via API
- **`schema.sql`** - Complete SQL schema for all tables with RLS policies
- **`create-helper-function.sql`** - Creates helper function for SQL execution
- **`fix-schema-decimal.sql`** - Fixes publications table to support decimal values

### Migration Scripts
- **`migrate-publications.js`** - Migrates publications data (1387 records)
- **`migrate-social-posts.js`** - Migrates social posts data
- **`migrate-digital-tv.js`** - Migrates digital TV data
- **`migrate-best-sellers.js`** - Migrates best sellers data
- **`migrate-listicles.js`** - Migrates listicles data
- **`migrate-pr-bundles.js`** - Migrates PR bundles data
- **`migrate-print.js`** - Migrates print data
- **`migrate-broadcast-tv.js`** - Migrates broadcast TV data
- **`retry-failed-publications.js`** - Retries failed publication migrations

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

Optional (for automatic schema setup):
```
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Step-by-Step Setup

1. **Create helper function** (one-time):
   - Open Supabase SQL Editor
   - Run `scripts/create-helper-function.sql`

2. **Setup schema**:
   ```bash
   yarn setup:schema:auto
   ```
   Or manually run `scripts/schema.sql` in SQL Editor

3. **Fix publications schema** (if needed):
   - Run `scripts/fix-schema-decimal.sql` in SQL Editor
   - This allows decimal values in `domain_authority` and `domain_rating`

4. **Migrate all data**:
   ```bash
   yarn migrate:all
   ```

5. **Retry failed publications** (if any):
   ```bash
   yarn migrate:retry-failed
   ```

## Troubleshooting

- **RLS Policy Errors**: Make sure you ran the schema.sql which includes RLS policies
- **Helper Function Missing**: Run `create-helper-function.sql` first
- **Service Role Key**: Get it from Supabase Dashboard → Settings → API → service_role key
- **Decimal Values Error**: Run `fix-schema-decimal.sql` to fix publications table
- **Duplicate Records**: PR bundles and print tables will delete existing records before inserting to avoid duplicates

## Migration Order

1. Publications (already done)
2. Social Posts
3. Digital TV
4. Best Sellers
5. Listicles
6. PR Bundles
7. Print
8. Broadcast TV

You can run them individually or use `yarn migrate:all` to run all at once.
