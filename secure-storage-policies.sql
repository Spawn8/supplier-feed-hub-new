-- Secure Storage Policies for Supplier Feed Hub
-- Run this SQL in your Supabase SQL editor to make storage private

-- ==================================================
-- 1. REMOVE PUBLIC ACCESS FROM FEEDS BUCKET
-- ==================================================

-- Drop existing public policies
DROP POLICY IF EXISTS "Public read feeds" ON storage.objects;

-- ==================================================
-- 2. AUTHENTICATED ACCESS POLICIES FOR FEEDS BUCKET
-- ==================================================

-- Allow authenticated users to upload to their workspace folders
CREATE POLICY "Authenticated upload to feeds"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'feeds' AND
  (storage.foldername(name))[1] IN (
    SELECT workspace_id::text FROM workspace_members 
    WHERE user_id = auth.uid()
  )
);

-- Allow authenticated users to read files from their workspace folders
CREATE POLICY "Authenticated read from feeds"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'feeds' AND
  (storage.foldername(name))[1] IN (
    SELECT workspace_id::text FROM workspace_members 
    WHERE user_id = auth.uid()
  )
);

-- Allow authenticated users to update files in their workspace folders
CREATE POLICY "Authenticated update feeds"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'feeds' AND
  (storage.foldername(name))[1] IN (
    SELECT workspace_id::text FROM workspace_members 
    WHERE user_id = auth.uid()
  )
);

-- Allow authenticated users to delete files from their workspace folders
CREATE POLICY "Authenticated delete feeds"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'feeds' AND
  (storage.foldername(name))[1] IN (
    SELECT workspace_id::text FROM workspace_members 
    WHERE user_id = auth.uid()
  )
);

-- ==================================================
-- 3. AUTHENTICATED ACCESS POLICIES FOR SUPPLIER-FILES BUCKET (if used)
-- ==================================================

-- Allow authenticated users to upload to supplier-files
CREATE POLICY "Authenticated upload to supplier-files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'supplier-files' AND
  (storage.foldername(name))[1] IN (
    SELECT workspace_id::text FROM workspace_members 
    WHERE user_id = auth.uid()
  )
);

-- Allow authenticated users to read from supplier-files
CREATE POLICY "Authenticated read from supplier-files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'supplier-files' AND
  (storage.foldername(name))[1] IN (
    SELECT workspace_id::text FROM workspace_members 
    WHERE user_id = auth.uid()
  )
);

-- Allow authenticated users to update supplier-files
CREATE POLICY "Authenticated update supplier-files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'supplier-files' AND
  (storage.foldername(name))[1] IN (
    SELECT workspace_id::text FROM workspace_members 
    WHERE user_id = auth.uid()
  )
);

-- Allow authenticated users to delete supplier-files
CREATE POLICY "Authenticated delete supplier-files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'supplier-files' AND
  (storage.foldername(name))[1] IN (
    SELECT workspace_id::text FROM workspace_members 
    WHERE user_id = auth.uid()
  )
);
