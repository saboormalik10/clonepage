# Supabase Setup Guide

This guide will help you set up Supabase for your Next.js application.

## Prerequisites

1. A Supabase account (sign up at https://supabase.com)
2. A Supabase project created

## Step 1: Create Supabase Project

1. Go to https://app.supabase.com
2. Click "New Project"
3. Fill in your project details
4. Wait for the project to be created

## Step 2: Get Your Supabase Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (this is your `NEXT_PUBLIC_SUPABASE_URL`)
   - **anon/public key** (this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

## Step 3: Configure Environment Variables

1. Copy `.env.local.example` to `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```

2. Edit `.env.local` and add your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

## Step 4: Create Database Tables

Run the following SQL in your Supabase SQL Editor (Dashboard → SQL Editor):

### Publications Table

```sql
-- Create publications table
CREATE TABLE IF NOT EXISTS publications (
  _id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo JSONB,
  genres JSONB DEFAULT '[]'::jsonb,
  default_price INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  custom_price INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  domain_authority INTEGER,
  domain_rating INTEGER,
  estimated_time TEXT,
  regions JSONB DEFAULT '[]'::jsonb,
  sponsored TEXT,
  indexed TEXT,
  do_follow TEXT,
  article_preview JSONB,
  image TEXT,
  url TEXT,
  health BOOLEAN,
  health_multiplier TEXT,
  cbd BOOLEAN,
  cbd_multiplier TEXT,
  crypto BOOLEAN,
  crypto_multiplier TEXT,
  gambling BOOLEAN,
  gambling_multiplier TEXT,
  erotic BOOLEAN,
  erotic_multiplier TEXT,
  erotic_price INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE publications ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access
CREATE POLICY "Allow public read access" ON publications
  FOR SELECT USING (true);
```

### Social Posts Table

```sql
CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication TEXT NOT NULL,
  image TEXT,
  url TEXT,
  platforms TEXT[] DEFAULT ARRAY[]::TEXT[],
  price TEXT,
  tat TEXT,
  example_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE social_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON social_posts
  FOR SELECT USING (true);
```

### Digital TV Table

```sql
CREATE TABLE IF NOT EXISTS digital_tv (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sign TEXT,
  station TEXT NOT NULL,
  rate TEXT,
  tat TEXT,
  sponsored TEXT,
  indexed TEXT,
  segment_length TEXT,
  location TEXT,
  program_name TEXT,
  interview_type TEXT,
  example_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE digital_tv ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON digital_tv
  FOR SELECT USING (true);
```

### Best Sellers Table

```sql
CREATE TABLE IF NOT EXISTS best_sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication TEXT NOT NULL,
  image TEXT,
  genres TEXT,
  price TEXT,
  da TEXT,
  dr TEXT,
  tat TEXT,
  region TEXT,
  sponsored TEXT,
  indexed TEXT,
  dofollow TEXT,
  example_url TEXT,
  has_image TEXT,
  niches TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE best_sellers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON best_sellers
  FOR SELECT USING (true);
```

### Listicles Table

```sql
CREATE TABLE IF NOT EXISTS listicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication TEXT NOT NULL,
  image TEXT,
  genres TEXT,
  price TEXT,
  da TEXT,
  dr TEXT,
  tat TEXT,
  region TEXT,
  sponsored TEXT,
  indexed TEXT,
  dofollow TEXT,
  example_url TEXT,
  has_image TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE listicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON listicles
  FOR SELECT USING (true);
```

### PR Bundles Table

```sql
CREATE TABLE IF NOT EXISTS pr_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  bundles JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE pr_bundles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON pr_bundles
  FOR SELECT USING (true);
```

### Print Table

```sql
CREATE TABLE IF NOT EXISTS print (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  magazines JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE print ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON print
  FOR SELECT USING (true);
```

### Broadcast TV Table

```sql
CREATE TABLE IF NOT EXISTS broadcast_tv (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate TEXT,
  calls TEXT,
  state TEXT,
  market TEXT,
  program TEXT,
  location TEXT,
  time TEXT,
  rate TEXT,
  example_url TEXT,
  intake_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE broadcast_tv ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON broadcast_tv
  FOR SELECT USING (true);
```

## Step 5: Import Data from JSON Files

You can import your existing JSON data into Supabase using one of these methods:

### Option A: Using Supabase Dashboard

1. Go to **Table Editor** in your Supabase dashboard
2. Select the table you want to import data into
3. Click "Insert" → "Import data from CSV/JSON"
4. Upload your JSON file (you may need to convert it to the right format)

### Option B: Using SQL Scripts

You can create a script to import your JSON data. Here's an example for publications:

```sql
-- Example: Insert a publication
INSERT INTO publications (
  _id, name, logo, genres, default_price, domain_authority, domain_rating, 
  estimated_time, regions, sponsored, indexed, do_follow, article_preview, 
  image, url, health, cbd, crypto, gambling, erotic
) VALUES (
  '0071b081-fad5-479e-9139-058a655e5473',
  'Windsor Star',
  '{"_type": "image", "asset": {"_ref": "image-83f2052837ecd04193a9e3859613ba60d1363af1-400x300-png", "_type": "reference"}}'::jsonb,
  '[{"name": "News", "description": null, "slug": "news"}]'::jsonb,
  ARRAY[1500],
  82,
  75,
  '4-6 Weeks',
  '[{"name": "Canada", "description": null, "slug": "canada"}]'::jsonb,
  'yes',
  'yes',
  'no',
  NULL,
  'yes',
  'http://windsorstar.com',
  true,
  true,
  true,
  true,
  true
);
```

### Option C: Using a Migration Script

Create a Node.js script to import all your JSON data:

```javascript
// scripts/import-data.js
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function importPublications() {
  const data = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../data/publicationsData.json'), 'utf8')
  )
  
  const publications = data.result || []
  
  for (const pub of publications) {
    const { error } = await supabase
      .from('publications')
      .upsert({
        _id: pub._id,
        name: pub.name,
        logo: pub.logo,
        genres: pub.genres,
        default_price: pub.defaultPrice,
        custom_price: pub.customPrice,
        domain_authority: pub.domain_authority,
        domain_rating: pub.domain_rating,
        estimated_time: pub.estimated_time,
        regions: pub.regions,
        sponsored: pub.sponsored,
        indexed: pub.indexed,
        do_follow: pub.do_follow,
        article_preview: pub.articlePreview,
        image: pub.image,
        url: pub.url,
        health: pub.health,
        health_multiplier: pub.healthMultiplier,
        cbd: pub.cbd,
        cbd_multiplier: pub.cbdMultiplier,
        crypto: pub.crypto,
        crypto_multiplier: pub.cryptoMultiplier,
        gambling: pub.gambling,
        gambling_multiplier: pub.gamblingMultiplier,
        erotic: pub.erotic,
        erotic_multiplier: pub.eroticMultiplier,
        erotic_price: pub.eroticPrice
      }, { onConflict: '_id' })
    
    if (error) {
      console.error('Error importing publication:', pub.name, error)
    }
  }
  
  console.log('Import completed!')
}

importPublications()
```

## Step 6: Test the Integration

1. Start your development server:
   ```bash
   yarn dev
   ```

2. The application will:
   - Try to fetch data from Supabase if environment variables are set
   - Fall back to JSON files if Supabase is not configured or if there's an error

3. Check the browser console and server logs for any errors

## Notes

- The API routes automatically fall back to JSON files if Supabase is not configured
- All tables use Row Level Security (RLS) with public read access
- You can modify the RLS policies in Supabase dashboard for more security
- The column names in Supabase use snake_case (e.g., `default_price`) but the API transforms them to match your TypeScript interfaces (e.g., `defaultPrice`)




