-- Add target_fields column to supplier_category_mapping_settings table

ALTER TABLE supplier_category_mapping_settings 
ADD COLUMN IF NOT EXISTS target_fields JSONB DEFAULT '[]'::jsonb;

-- Add comment
COMMENT ON COLUMN supplier_category_mapping_settings.target_fields IS 'Array of field keys that will be updated with mapped category values';

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_supplier_category_mapping_settings_target_fields 
ON supplier_category_mapping_settings USING GIN (target_fields);


