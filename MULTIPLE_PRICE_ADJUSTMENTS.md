# Multiple Price Adjustments Feature

## Overview
This feature allows admins to add multiple price adjustments (both global and user-specific) for any category/table, instead of being limited to one adjustment that replaces the previous one.

## Database Migration Required

Before using this feature, you must run the migration script to remove UNIQUE constraints:

```sql
-- Run this in your Supabase SQL Editor
-- File: scripts/remove-unique-constraints-price-adjustments.sql

ALTER TABLE global_price_adjustments 
DROP CONSTRAINT IF EXISTS global_price_adjustments_table_name_key;

ALTER TABLE user_price_adjustments 
DROP CONSTRAINT IF EXISTS user_price_adjustments_user_id_table_name_key;
```

## What Changed

### 1. Database Schema
- **Removed UNIQUE constraints**: Both `global_price_adjustments` and `user_price_adjustments` tables no longer have UNIQUE constraints, allowing multiple adjustments per table/user combination.

### 2. Backend Changes

#### `lib/price-adjustments.ts`
- `getPriceAdjustments()`: Now returns arrays of adjustments instead of single objects
- `applyPriceAdjustment()`: Updated to handle arrays and apply adjustments sequentially

#### API Routes
- `app/api/admin/prices/global/route.ts`: 
  - POST now uses `insert()` instead of `upsert()` to allow multiple adjustments
  - DELETE supports both ID-based (single) and table_name-based (all) deletion
- `app/api/admin/prices/users/route.ts`:
  - POST now uses `insert()` instead of `upsert()` to allow multiple adjustments

#### Utility Functions
- `lib/price-adjustment-utils.ts`: Updated all functions to handle arrays of adjustments

### 3. Admin UI Changes

#### Global Prices Page (`app/admin/prices/global/page.tsx`)
- Displays all adjustments grouped by table
- Shows count of adjustments per table
- Each adjustment can be removed individually
- Updated description to mention multiple adjustments

#### User Prices Page (`app/admin/prices/users/page.tsx`)
- Displays all user adjustments in a list
- Each adjustment shows user, table, and adjustment details
- Each adjustment can be removed individually
- Updated description to mention multiple adjustments

## How It Works

### Adjustment Application Order
1. **Global adjustments** are applied first, in the order they were created (oldest first)
2. **User adjustments** are then applied, in the order they were created (oldest first)
3. Each adjustment checks if the price is within its min/max range before applying
4. If `exact_amount` is set, it replaces the price; otherwise, percentage adjustment is applied

### Example Scenario
For a base price of $1000:

1. Global adjustment 1: +10% (applies to all prices)
   - Result: $1100

2. Global adjustment 2: +5% (applies to prices $1000-$2000)
   - Result: $1155

3. User adjustment 1: -5% (applies to prices $1000-$3000)
   - Result: $1097.25

4. User adjustment 2: Exact amount $1200 (applies to prices $1000-$2000)
   - Result: $1200 (replaces price)

Final adjusted price: **$1200**

## Usage

### Adding Multiple Global Adjustments
1. Go to Admin → Global Prices
2. Click "Apply Global Adjustment"
3. Select table, set adjustment type (percentage or exact amount), optionally set price range
4. Click "Apply Adjustment"
5. Repeat to add more adjustments for the same table

### Adding Multiple User Adjustments
1. Go to Admin → User Prices
2. Click "Apply User Adjustment"
3. Select user, table, set adjustment type, optionally set price range
4. Click "Apply Adjustment"
5. Repeat to add more adjustments for the same user/table combination

### Removing Adjustments
- Click "Remove" next to any adjustment to delete it individually
- Adjustments are removed immediately and prices will update on next fetch

## Backward Compatibility

The code maintains backward compatibility:
- If a single adjustment object is passed (legacy format), it's automatically converted to an array
- Existing single adjustments will continue to work
- All user-side API routes automatically handle the new array format

## Testing

After running the migration:
1. Add multiple global adjustments for the same table
2. Add multiple user adjustments for the same user/table
3. Verify prices are adjusted correctly on user-side tabs
4. Test removing individual adjustments
5. Verify price ranges work correctly with multiple adjustments

