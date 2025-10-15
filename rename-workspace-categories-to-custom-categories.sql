-- Rename workspace_categories to custom_categories
-- This migration updates the table name and all related references

-- Step 1: Rename the main table
ALTER TABLE workspace_categories RENAME TO custom_categories;

-- Step 2: Update foreign key references in category_mappings
ALTER TABLE category_mappings 
DROP CONSTRAINT IF EXISTS category_mappings_workspace_category_id_fkey;

ALTER TABLE category_mappings 
ADD CONSTRAINT category_mappings_workspace_category_id_fkey 
FOREIGN KEY (workspace_category_id) REFERENCES custom_categories(id);

-- Step 3: Update foreign key references in products_final
ALTER TABLE products_final 
DROP CONSTRAINT IF EXISTS products_final_category_id_fkey;

ALTER TABLE products_final 
ADD CONSTRAINT products_final_category_id_fkey 
FOREIGN KEY (category_id) REFERENCES custom_categories(id);

-- Step 4: Update indexes
DROP INDEX IF EXISTS idx_workspace_categories_workspace;
CREATE INDEX idx_custom_categories_workspace ON custom_categories(workspace_id);

-- Step 5: Drop old RLS policies
DROP POLICY IF EXISTS "Users can view workspace categories in their workspaces" ON custom_categories;
DROP POLICY IF EXISTS "Users can insert workspace categories in their workspaces" ON custom_categories;
DROP POLICY IF EXISTS "Users can update workspace categories in their workspaces" ON custom_categories;
DROP POLICY IF EXISTS "Users can delete workspace categories in their workspaces" ON custom_categories;

-- Step 6: Create new RLS policies for custom_categories
CREATE POLICY "Users can view custom categories in their workspaces" ON custom_categories
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert custom categories in their workspaces" ON custom_categories
    FOR INSERT WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Users can update custom categories in their workspaces" ON custom_categories
    FOR UPDATE USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Users can delete custom categories in their workspaces" ON custom_categories
    FOR DELETE USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Step 7: Update category_mappings policies to reference custom_categories
DROP POLICY IF EXISTS "Users can view category mappings in their workspaces" ON category_mappings;
DROP POLICY IF EXISTS "Users can insert category mappings in their workspaces" ON category_mappings;
DROP POLICY IF EXISTS "Users can update category mappings in their workspaces" ON category_mappings;
DROP POLICY IF EXISTS "Users can delete category mappings in their workspaces" ON category_mappings;

CREATE POLICY "Users can view category mappings in their workspaces" ON category_mappings
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert category mappings in their workspaces" ON category_mappings
    FOR INSERT WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Users can update category mappings in their workspaces" ON category_mappings
    FOR UPDATE USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Users can delete category mappings in their workspaces" ON category_mappings
    FOR DELETE USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Step 8: Update comments
COMMENT ON TABLE custom_categories IS 'Workspace-specific custom categories for product organization';
COMMENT ON COLUMN category_mappings.workspace_category_id IS 'References custom_categories.id';
COMMENT ON COLUMN products_final.category_id IS 'References custom_categories.id';

