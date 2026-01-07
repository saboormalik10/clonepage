# Brand Customization Feature

This document describes the brand customization feature that allows each user to have their own brand name and logo displayed throughout the application.

## Database Schema Changes

### New Fields Added to `user_profiles` Table

- `brand_name` (TEXT, nullable): The brand name that replaces "Vexis Collective" in the UI
- `brand_logo` (TEXT, nullable): URL to the brand logo image that replaces the default logo

### Migration Script

Run the SQL migration script to add these fields:

```bash
# File: scripts/add-brand-fields.sql
```

This script adds the two new columns to the `user_profiles` table.

## Implementation Details

### 1. Admin Panel - User Creation

When creating a new user in the admin panel (`/admin/users`), admins can now specify:
- **Brand Name**: The name that will be displayed instead of "Vexis Collective"
- **Brand Logo**: Upload a logo image file (JPEG, PNG, WebP, or GIF, max 5MB). The image will be uploaded to Supabase storage and the public URL will be stored automatically.

### 2. Dynamic Brand Display

The application now dynamically displays:
- **Brand Name**: Replaces "Vexis Collective" in:
  - Header component (top navigation)
  - Main page title ("Pricing ({brandName})")
  
- **Brand Logo**: Replaces the default logo in:
  - Header component (top navigation)

### 3. Fallback Behavior

If a user doesn't have a brand name or logo configured:
- Brand name defaults to "Vexis Collective"
- Brand logo defaults to "/logo.jpeg"

### 4. Components Updated

- `components/Header.tsx`: Uses `useUserProfile` hook to get brand info
- `app/page.tsx`: Uses `useUserProfile` hook to display brand name in title
- `app/admin/users/page.tsx`: Added form fields for brand name and logo
- `app/api/admin/users/route.ts`: Updated to save brand info when creating users

### 5. New Hook

- `hooks/useUserProfile.ts`: Custom hook to fetch user profile including brand information

## Usage

### For Admins

1. Go to `/admin/users`
2. Click "Create User"
3. Fill in the user details including:
   - Brand Name (optional)
   - Brand Logo URL (optional)
4. The brand info will be displayed for that user when they log in

### For Users

When a user logs in, they will see:
- Their custom brand name instead of "Vexis Collective"
- Their custom logo instead of the default logo

## Notes

- The `layout.tsx` and `manifest.ts` files keep the default "Vexis Collective" as they are server-side metadata files
- Brand logos are uploaded to Supabase storage (publications bucket, logos folder) and stored as public URLs
- Supported image formats: JPEG, PNG, WebP, GIF
- Maximum file size: 5MB
- If a brand logo fails to load, it will automatically fallback to the default logo
- The upload uses the same storage bucket and API endpoint as other image uploads in the application

