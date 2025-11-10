# Admin Panel Setup Guide

This guide will help you set up the admin panel for managing users and price adjustments.

## Prerequisites

1. Supabase project with the main tables already set up
2. Service Role Key from Supabase (for admin operations)

## Step 1: Set Up Database Schema

Run the SQL script in your Supabase SQL Editor:

```bash
# The schema file is located at:
scripts/admin-schema.sql
```

Or copy and paste the contents of `scripts/admin-schema.sql` into your Supabase SQL Editor and run it.

This will create:
- `user_profiles` table - Stores user information and roles
- `user_price_adjustments` table - Stores user-specific price adjustments
- `global_price_adjustments` table - Stores global price adjustments
- Required RLS policies and triggers

## Step 2: Configure Environment Variables

Add the following to your `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**Important:** The `SUPABASE_SERVICE_ROLE_KEY` is required for admin operations like creating users. You can find it in:
- Supabase Dashboard → Settings → API → Service Role Key (secret)

## Step 3: Create First Admin User

You need to create the first admin user manually in Supabase:

1. Go to Supabase Dashboard → Authentication → Users
2. Click "Add user" → "Create new user"
3. Enter email and password
4. After creating, go to SQL Editor and run:

```sql
-- Replace 'user-email@example.com' with the email you just created
UPDATE user_profiles 
SET role = 'admin' 
WHERE email = 'user-email@example.com';
```

Alternatively, you can create the admin user directly via SQL:

```sql
-- This will create both the auth user and profile
-- Note: You'll need to use Supabase Admin API or Dashboard to set the password
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES (
  'admin@example.com',
  crypt('your-secure-password', gen_salt('bf')),
  NOW(),
  NOW(),
  NOW()
) RETURNING id;

-- Then update the profile to be admin (the trigger should create the profile)
UPDATE user_profiles 
SET role = 'admin' 
WHERE email = 'admin@example.com';
```

**Note:** The easiest way is to create the user in the Dashboard, then update the role via SQL.

## Step 4: Access the Admin Panel

1. Start your development server:
   ```bash
   yarn dev
   ```

2. Navigate to: `http://localhost:3000/admin/login`

3. Login with your admin credentials

4. You'll be redirected to the admin dashboard

## Features

### User Management (`/admin/users`)
- Create new users (admin or regular user)
- View all users
- Delete users
- Users can be created with different roles

### Global Price Management (`/admin/prices/global`)
- Apply percentage adjustments to all tables globally
- Adjustments affect all users
- Can be removed to revert prices

### User-Specific Price Management (`/admin/prices/users`)
- Apply percentage adjustments for specific users
- Adjustments are applied on top of global adjustments
- Each user can have different adjustments per table

## How Price Adjustments Work

1. **Global Adjustments**: Applied to all users
   - Example: +10% global adjustment means all prices increase by 10%

2. **User Adjustments**: Applied on top of global adjustments
   - Example: If global is +10% and user adjustment is +5%, the total is +15%
   - Formula: `final_price = base_price * (1 + global%) * (1 + user%)`

3. **Price Application**: 
   - Adjustments are applied when data is fetched via API routes
   - The API routes check for adjustments and modify prices before returning data
   - Original prices in the database remain unchanged

## API Usage

When fetching data, you can optionally pass a `userId` query parameter to get user-specific pricing:

```
GET /api/publications?userId=user-uuid-here
```

If no userId is provided, only global adjustments are applied (if any).

## Security Notes

1. **Service Role Key**: Keep this secret! Never expose it in client-side code
2. **RLS Policies**: All tables have Row Level Security enabled
3. **Admin Check**: All admin operations verify the user is an admin
4. **Authentication**: All admin routes require authentication

## Troubleshooting

### "Missing Supabase service role key"
- Make sure `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.local`
- Restart your dev server after adding it

### "Unauthorized" errors
- Check that you're logged in as an admin
- Verify the user's role in `user_profiles` table is 'admin'

### Price adjustments not applying
- Check that adjustments exist in the database
- Verify the userId is being passed correctly
- Check browser console and server logs for errors

### Can't create users
- Verify `SUPABASE_SERVICE_ROLE_KEY` is correct
- Check that the admin-schema.sql was run successfully
- Ensure RLS policies allow admin operations






