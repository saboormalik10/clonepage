-- Create Storage Bucket for Publications Logos
-- Run this in your Supabase SQL Editor

-- Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'publications',
  'publications',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Create storage policy to allow authenticated users to upload
CREATE POLICY "Allow authenticated users to upload logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'publications' AND
  (storage.foldername(name))[1] = 'logos'
);

-- Create storage policy to allow public read access
CREATE POLICY "Allow public read access to logos"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'publications' AND
  (storage.foldername(name))[1] = 'logos'
);

-- Create storage policy to allow authenticated users to delete their own uploads
CREATE POLICY "Allow authenticated users to delete logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'publications' AND
  (storage.foldername(name))[1] = 'logos'
);

