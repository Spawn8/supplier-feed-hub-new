-- Add is_visible column to custom_fields table
ALTER TABLE custom_fields 
ADD COLUMN is_visible BOOLEAN DEFAULT true;

-- Update existing fields to be visible by default
UPDATE custom_fields 
SET is_visible = true 
WHERE is_visible IS NULL;
