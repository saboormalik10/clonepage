# How to Verify Data Source (Supabase vs JSON)

## Method 1: Check Server Console Logs (Recommended)

When you run `yarn dev`, check your terminal/console output. You'll see messages like:

**✅ If loading from Supabase:**
```
✅ [Publications API] Loaded 1387 publications from Supabase
✅ [Social Posts API] Loaded 50 social posts from Supabase
✅ [Digital TV API] Loaded 25 digital TV entries from Supabase
```

**⚠️ If falling back to JSON:**
```
⚠️ [Publications API] Using JSON fallback (Supabase not configured or query failed)
⚠️ [Social Posts API] Using JSON fallback (Supabase not configured or query failed)
```

## Method 2: Check Browser Network Tab

1. Open your browser's Developer Tools (F12)
2. Go to the **Network** tab
3. Refresh the page
4. Look for API requests like `/api/publications`, `/api/social-posts`, etc.
5. Click on a request and check the **Response** tab
6. Compare the data with your JSON files

**If from Supabase:**
- Response will have data from your Supabase tables
- May have different ordering or structure

**If from JSON:**
- Response will match exactly what's in your JSON files

## Method 3: Check Supabase Dashboard

1. Go to your Supabase project dashboard
2. Navigate to **Table Editor**
3. Check if your tables have data
4. Compare the count with what you see in the app

**If tables are empty:**
- App will fall back to JSON files

**If tables have data:**
- App should load from Supabase (unless there's a connection issue)

## Method 4: Temporarily Remove JSON Files

**⚠️ Warning: Only do this for testing!**

1. Temporarily rename your JSON files (e.g., `publicationsData.json.bak`)
2. Restart your dev server
3. If the app still works → Loading from Supabase ✅
4. If the app breaks → Was loading from JSON ⚠️
5. **Remember to restore the files!**

## Method 5: Check Environment Variables

Make sure your `.env.local` file has:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

**If missing:**
- App will automatically use JSON files

**If present:**
- App will try to connect to Supabase first

## Method 6: Add Visual Indicator (Optional)

You can add a visual indicator in your UI to show the data source. For example, in your components:

```typescript
const [dataSource, setDataSource] = useState<'supabase' | 'json'>('json')

useEffect(() => {
  const fetchData = async () => {
    try {
      const response = await fetch('/api/publications')
      const data = await response.json()
      
      // Check response headers or add metadata to response
      // For now, you can check if data matches Supabase structure
      setDataSource('supabase') // or 'json'
    } catch (error) {
      setDataSource('json')
    }
  }
  fetchData()
}, [])

// Then display in UI
<div className="text-xs text-gray-500">
  Data source: {dataSource === 'supabase' ? '✅ Supabase' : '📄 JSON'}
</div>
```

## Quick Test

1. **Start your dev server:** `yarn dev`
2. **Open browser console** (F12 → Console tab)
3. **Check terminal/console** where you ran `yarn dev`
4. **Look for the log messages** showing which source is being used

## Common Issues

### "Using JSON fallback" but Supabase is configured
- Check if your Supabase URL and key are correct
- Verify RLS policies allow public read access
- Check if tables have data
- Look for error messages in the console

### "Loaded from Supabase" but data looks wrong
- Check data transformation in API routes
- Verify column names match between database and API
- Check for any data type mismatches

## Summary

The easiest way is to **check your terminal/console** when running `yarn dev`. The log messages will clearly show:
- ✅ `Loaded X from Supabase` = Using Supabase
- ⚠️ `Using JSON fallback` = Using JSON files

