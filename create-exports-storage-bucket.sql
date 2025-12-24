-- Create Storage Bucket and Policies for Exports
-- 
-- IMPORTANT: Storage buckets cannot be created via SQL.
-- You must create the bucket first via Supabase Dashboard:
-- 1. Go to Storage in your Supabase dashboard
-- 2. Click "New bucket"
-- 3. Name: "exports"
-- 4. Public bucket: NO (unchecked - keep it private)
-- 5. File size limit: Set as needed (e.g., 100MB)
-- 6. Allowed MIME types: Leave empty or add: text/csv, application/json, application/xml
-- 7. Click "Create bucket"
--
-- Then run this SQL to set up the policies:

-- ==================================================
-- EXPORTS BUCKET STORAGE POLICIES
-- ==================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated upload to exports" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated read from exports" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update exports" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete exports" ON storage.objects;

-- Allow authenticated users to upload to their workspace folders in exports bucket
CREATE POLICY "Authenticated upload to exports"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'exports' AND
  (storage.foldername(name))[1] IN (
    SELECT workspace_id::text FROM workspace_members 
    WHERE user_id = auth.uid()
  )
);

-- Allow authenticated users to read files from their workspace folders in exports bucket
CREATE POLICY "Authenticated read from exports"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'exports' AND
  (storage.foldername(name))[1] IN (
    SELECT workspace_id::text FROM workspace_members 
    WHERE user_id = auth.uid()
  )
);

-- Allow authenticated users to update files in their workspace folders in exports bucket
CREATE POLICY "Authenticated update exports"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'exports' AND
  (storage.foldername(name))[1] IN (
    SELECT workspace_id::text FROM workspace_members 
    WHERE user_id = auth.uid()
  )
);

-- Allow authenticated users to delete files from their workspace folders in exports bucket
CREATE POLICY "Authenticated delete exports"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'exports' AND
  (storage.foldername(name))[1] IN (
    SELECT workspace_id::text FROM workspace_members 
    WHERE user_id = auth.uid()
  )
);

-- ==================================================
-- VERIFICATION
-- ==================================================

-- Check if bucket exists (this will show buckets, but creation must be done via dashboard)
-- Note: You can't check bucket existence via SQL, but you can verify policies:

SELECT schemaname, tablename, policyname, cmd
FROM pg_policies 
WHERE tablename = 'objects'
  AND policyname LIKE '%exports%'
ORDER BY policyname;

