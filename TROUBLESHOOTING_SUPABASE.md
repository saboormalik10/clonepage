# Troubleshooting Supabase Connection

## ✅ What I've Fixed

1. **Added detailed error logging** - You'll now see exactly why Supabase is failing
2. **Improved environment variable checking** - Clear messages about missing variables
3. **Better Supabase client initialization** - Fresh client on each request

## 🔍 How to Debug

After restarting your dev server (`yarn dev`), check the terminal logs. You'll see one of these:

### Scenario 1: Missing Environment Variables
```
❌ [Publications API] Missing Supabase environment variables:
   NEXT_PUBLIC_SUPABASE_URL: ❌ Missing
   NEXT_PUBLIC_SUPABASE_ANON_KEY: ❌ Missing
```

**Fix:** Make sure `.env.local` exists and has the correct values.

### Scenario 2: Supabase Query Error
```
❌ [Publications API] Supabase query error: {...}
   Error code: 42P01
   Error message: relation "publications" does not exist
```

**Common Error Codes:**
- `42P01` - Table doesn't exist → Create the table in Supabase
- `42501` - Permission denied → Check RLS policies
- `PGRST116` - No rows returned → Table is empty

**Fix:** 
- Go to Supabase Dashboard → SQL Editor
- Run the schema creation SQL (see `SUPABASE_SETUP.md`)
- Make sure RLS policies are set correctly

### Scenario 3: Empty Data
```
⚠️ [Publications API] Supabase returned empty data array
```

**Fix:** 
- Check if data exists in Supabase Dashboard → Table Editor
- Run migration scripts to import JSON data:
  ```bash
  yarn migrate:publications
  ```

### Scenario 4: Connection Issue
```
❌ [Publications API] Error fetching publications: Network error
```

**Fix:**
- Check your internet connection
- Verify Supabase URL is correct
- Check Supabase project status (might be paused)

## 🧪 Quick Test

1. **Check environment variables are loaded:**
   ```bash
   # In your terminal, run:
   node -e "require('dotenv').config({path: '.env.local'}); console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)"
   ```

2. **Test Supabase connection directly:**
   ```bash
   # Create a test file: test-supabase.js
   require('dotenv').config({path: '.env.local'})
   const { createClient } = require('@supabase/supabase-js')
   const supabase = createClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL,
     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
   )
   supabase.from('publications').select('count').then(console.log)
   ```

3. **Check Supabase Dashboard:**
   - Go to https://app.supabase.com
   - Select your project
   - Go to Table Editor → Check if `publications` table exists
   - Go to SQL Editor → Run: `SELECT COUNT(*) FROM publications;`

## 📋 Checklist

- [ ] `.env.local` file exists and has correct values
- [ ] Supabase project is active (not paused)
- [ ] Tables are created in Supabase (check Table Editor)
- [ ] RLS policies are set (check Authentication → Policies)
- [ ] Data exists in tables (check Table Editor)
- [ ] Dev server restarted after `.env.local` changes

## 🔄 Next Steps

After restarting `yarn dev`, look for these log messages:

**If you see:**
- `✅ [Supabase] Client initialized` → Connection is working
- `🔍 [Publications API] Attempting to fetch from Supabase...` → Query is being attempted
- `✅ [Publications API] Loaded X publications from Supabase` → **SUCCESS!**

**If you see:**
- `❌ [Publications API] Supabase query error` → Check the error details above
- `⚠️ [Publications API] Using JSON fallback` → Check why (error message will tell you)


