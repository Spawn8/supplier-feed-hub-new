-- Add source_path column to suppliers table for uploaded files
ALTER TABLE suppliers ADD COLUMN source_path TEXT;

-- Add comment to explain the column
COMMENT ON COLUMN suppliers.source_path IS 'Path to uploaded file in Supabase Storage (feeds bucket)';
