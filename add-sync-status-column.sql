-- Add missing sync status columns to suppliers table
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS last_sync_status VARCHAR(20) DEFAULT 'never';
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS last_sync_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS last_sync_completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS last_sync_duration_ms INTEGER;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS last_sync_items_total INTEGER DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS last_sync_items_success INTEGER DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS last_sync_items_errors INTEGER DEFAULT 0;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS last_sync_error_message TEXT;

-- Add creation timestamps
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS creation_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS creation_completed_at TIMESTAMP WITH TIME ZONE;

-- Rename created_at to creation_completed_at if it doesn't exist
-- (This might need to be done manually if created_at already exists)
-- ALTER TABLE suppliers RENAME COLUMN created_at TO creation_completed_at;