-- Add use_for_category_mapping column to custom_fields table

ALTER TABLE custom_fields 
ADD COLUMN IF NOT EXISTS use_for_category_mapping BOOLEAN DEFAULT FALSE;

-- Add comment
COMMENT ON COLUMN custom_fields.use_for_category_mapping IS 'Indicates if this field is used for category mapping purposes';

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_custom_fields_category_mapping 
ON custom_fields(workspace_id, use_for_category_mapping) 
WHERE use_for_category_mapping = true;


