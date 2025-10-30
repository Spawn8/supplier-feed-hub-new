-- Create table for storing supplier category mapping settings
CREATE TABLE IF NOT EXISTS supplier_category_mapping_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  category_mapping_enabled BOOLEAN DEFAULT false,
  selected_category_field TEXT,
  categories_loaded BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(supplier_id)
);

-- Add RLS policies
ALTER TABLE supplier_category_mapping_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access settings for suppliers in their workspaces
CREATE POLICY "Users can access settings for their workspace suppliers" ON supplier_category_mapping_settings
  FOR ALL USING (
    supplier_id IN (
      SELECT s.id FROM suppliers s
      JOIN workspace_members wm ON s.workspace_id = wm.workspace_id
      WHERE wm.user_id = auth.uid()
    )
  );

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_supplier_category_mapping_settings_supplier_id 
ON supplier_category_mapping_settings(supplier_id);
