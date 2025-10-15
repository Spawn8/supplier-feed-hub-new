-- Add uid column to suppliers table
ALTER TABLE suppliers ADD COLUMN uid VARCHAR(255);

-- Create an index on uid for better performance
CREATE INDEX idx_suppliers_uid ON suppliers(uid);

-- Update existing suppliers with a default uid based on their name (if needed)
-- This is optional - you can run this if you want to populate existing records
-- UPDATE suppliers SET uid = LOWER(REPLACE(name, ' ', '_')) WHERE uid IS NULL;
