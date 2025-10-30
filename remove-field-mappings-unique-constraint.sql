-- Remove unique constraint from field_mappings to allow one-to-many mappings
-- This allows multiple custom fields to map to the same source field

-- Drop the existing unique constraint
ALTER TABLE field_mappings DROP CONSTRAINT IF EXISTS field_mappings_workspace_id_supplier_id_source_key_key;

-- Add a new unique constraint that allows multiple mappings per source_key
-- but prevents duplicate mappings (same workspace, supplier, source_key, and field_key)
ALTER TABLE field_mappings ADD CONSTRAINT field_mappings_unique_mapping 
UNIQUE (workspace_id, supplier_id, source_key, field_key);

-- Add comment explaining the change
COMMENT ON CONSTRAINT field_mappings_unique_mapping ON field_mappings IS 
'Allows multiple custom fields to map to the same source field, but prevents exact duplicates';
