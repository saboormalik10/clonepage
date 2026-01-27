-- Admin Settings Table Schema
-- Run this in your Supabase SQL Editor

-- ============================================
-- ADMIN SETTINGS TABLE
-- ============================================

-- Create admin_settings table to store global admin configuration
CREATE TABLE IF NOT EXISTS admin_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read admin settings (logo needs to be visible to all)
CREATE POLICY "Allow public read access" ON admin_settings
  FOR SELECT USING (true);

-- Policy: Admins can insert admin settings
CREATE POLICY "Admins can insert admin settings" ON admin_settings
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

-- Policy: Admins can update admin settings
CREATE POLICY "Admins can update admin settings" ON admin_settings
  FOR UPDATE USING (public.is_admin(auth.uid()));

-- Policy: Admins can delete admin settings
CREATE POLICY "Admins can delete admin settings" ON admin_settings
  FOR DELETE USING (public.is_admin(auth.uid()));

-- Insert default admin logo setting
INSERT INTO admin_settings (setting_key, setting_value)
VALUES ('admin_logo', NULL)
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================
-- STORAGE BUCKET SETUP
-- ============================================
-- Note: You also need to create a storage bucket named 'admin-assets' in Supabase Dashboard
-- Go to: Storage > Create new bucket > Name: admin-assets > Public bucket: Yes
-- 
-- Then add the following storage policies:
-- 
-- 1. Allow public read access:
--    Policy name: Allow public read
--    Allowed operation: SELECT
--    Policy definition: true
--
-- 2. Allow admin uploads:
--    Policy name: Allow admin uploads
--    Allowed operation: INSERT
--    Policy definition: (bucket_id = 'admin-assets' AND public.is_admin(auth.uid()))
--
-- 3. Allow admin updates:
--    Policy name: Allow admin updates
--    Allowed operation: UPDATE
--    Policy definition: (bucket_id = 'admin-assets' AND public.is_admin(auth.uid()))
--
-- 4. Allow admin deletes:
--    Policy name: Allow admin deletes
--    Allowed operation: DELETE
--    Policy definition: (bucket_id = 'admin-assets' AND public.is_admin(auth.uid()))
