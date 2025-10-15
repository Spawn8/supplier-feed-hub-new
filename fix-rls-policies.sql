-- Fix RLS Policies for Supplier Feed Hub
-- Run this SQL in your Supabase SQL editor

-- ==================================================
-- 1. SUPPLIERS TABLE POLICIES
-- ==================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view suppliers in their workspaces" ON suppliers;
DROP POLICY IF EXISTS "Users can create suppliers in their workspaces" ON suppliers;
DROP POLICY IF EXISTS "Users can update suppliers in their workspaces" ON suppliers;
DROP POLICY IF EXISTS "Users can delete suppliers in their workspaces" ON suppliers;

-- Create new policies for suppliers
CREATE POLICY "Users can view suppliers in their workspaces" ON suppliers
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create suppliers in their workspaces" ON suppliers
    FOR INSERT WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update suppliers in their workspaces" ON suppliers
    FOR UPDATE USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete suppliers in their workspaces" ON suppliers
    FOR DELETE USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

-- ==================================================
-- 2. FIELD_MAPPINGS TABLE POLICIES
-- ==================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view field mappings for their suppliers" ON field_mappings;
DROP POLICY IF EXISTS "Users can create field mappings for their suppliers" ON field_mappings;
DROP POLICY IF EXISTS "Users can update field mappings for their suppliers" ON field_mappings;
DROP POLICY IF EXISTS "Users can delete field mappings for their suppliers" ON field_mappings;

-- Create new policies for field_mappings
CREATE POLICY "Users can view field mappings for their suppliers" ON field_mappings
    FOR SELECT USING (
        supplier_id IN (
            SELECT id FROM suppliers 
            WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members 
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can create field mappings for their suppliers" ON field_mappings
    FOR INSERT WITH CHECK (
        supplier_id IN (
            SELECT id FROM suppliers 
            WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members 
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can update field mappings for their suppliers" ON field_mappings
    FOR UPDATE USING (
        supplier_id IN (
            SELECT id FROM suppliers 
            WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members 
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can delete field mappings for their suppliers" ON field_mappings
    FOR DELETE USING (
        supplier_id IN (
            SELECT id FROM suppliers 
            WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members 
                WHERE user_id = auth.uid()
            )
        )
    );

-- ==================================================
-- 3. FEED_INGESTIONS TABLE POLICIES
-- ==================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view feed ingestions for their suppliers" ON feed_ingestions;
DROP POLICY IF EXISTS "Users can create feed ingestions for their suppliers" ON feed_ingestions;
DROP POLICY IF EXISTS "Users can update feed ingestions for their suppliers" ON feed_ingestions;
DROP POLICY IF EXISTS "Users can delete feed ingestions for their suppliers" ON feed_ingestions;

-- Create new policies for feed_ingestions
CREATE POLICY "Users can view feed ingestions for their suppliers" ON feed_ingestions
    FOR SELECT USING (
        supplier_id IN (
            SELECT id FROM suppliers 
            WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members 
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can create feed ingestions for their suppliers" ON feed_ingestions
    FOR INSERT WITH CHECK (
        supplier_id IN (
            SELECT id FROM suppliers 
            WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members 
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can update feed ingestions for their suppliers" ON feed_ingestions
    FOR UPDATE USING (
        supplier_id IN (
            SELECT id FROM suppliers 
            WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members 
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can delete feed ingestions for their suppliers" ON feed_ingestions
    FOR DELETE USING (
        supplier_id IN (
            SELECT id FROM suppliers 
            WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members 
                WHERE user_id = auth.uid()
            )
        )
    );

-- ==================================================
-- 4. PRODUCTS_RAW TABLE POLICIES
-- ==================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view raw products for their suppliers" ON products_raw;
DROP POLICY IF EXISTS "Users can create raw products for their suppliers" ON products_raw;
DROP POLICY IF EXISTS "Users can update raw products for their suppliers" ON products_raw;
DROP POLICY IF EXISTS "Users can delete raw products for their suppliers" ON products_raw;

-- Create new policies for products_raw
CREATE POLICY "Users can view raw products for their suppliers" ON products_raw
    FOR SELECT USING (
        supplier_id IN (
            SELECT id FROM suppliers 
            WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members 
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can create raw products for their suppliers" ON products_raw
    FOR INSERT WITH CHECK (
        supplier_id IN (
            SELECT id FROM suppliers 
            WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members 
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can update raw products for their suppliers" ON products_raw
    FOR UPDATE USING (
        supplier_id IN (
            SELECT id FROM suppliers 
            WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members 
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can delete raw products for their suppliers" ON products_raw
    FOR DELETE USING (
        supplier_id IN (
            SELECT id FROM suppliers 
            WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members 
                WHERE user_id = auth.uid()
            )
        )
    );

-- ==================================================
-- 5. PRODUCTS_MAPPED TABLE POLICIES
-- ==================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view mapped products for their suppliers" ON products_mapped;
DROP POLICY IF EXISTS "Users can create mapped products for their suppliers" ON products_mapped;
DROP POLICY IF EXISTS "Users can update mapped products for their suppliers" ON products_mapped;
DROP POLICY IF EXISTS "Users can delete mapped products for their suppliers" ON products_mapped;

-- Create new policies for products_mapped
CREATE POLICY "Users can view mapped products for their suppliers" ON products_mapped
    FOR SELECT USING (
        supplier_id IN (
            SELECT id FROM suppliers 
            WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members 
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can create mapped products for their suppliers" ON products_mapped
    FOR INSERT WITH CHECK (
        supplier_id IN (
            SELECT id FROM suppliers 
            WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members 
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can update mapped products for their suppliers" ON products_mapped
    FOR UPDATE USING (
        supplier_id IN (
            SELECT id FROM suppliers 
            WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members 
                WHERE user_id = auth.uid()
            )
        )
    );

CREATE POLICY "Users can delete mapped products for their suppliers" ON products_mapped
    FOR DELETE USING (
        supplier_id IN (
            SELECT id FROM suppliers 
            WHERE workspace_id IN (
                SELECT workspace_id FROM workspace_members 
                WHERE user_id = auth.uid()
            )
        )
    );

-- ==================================================
-- 6. ACTIVITY_LOGS TABLE POLICIES (if needed)
-- ==================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view activity logs for their workspaces" ON activity_logs;
DROP POLICY IF EXISTS "Users can create activity logs for their workspaces" ON activity_logs;

-- Create new policies for activity_logs
CREATE POLICY "Users can view activity logs for their workspaces" ON activity_logs
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create activity logs for their workspaces" ON activity_logs
    FOR INSERT WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

-- ==================================================
-- VERIFICATION QUERIES
-- ==================================================

-- Check if RLS is enabled on all tables
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('suppliers', 'field_mappings', 'feed_ingestions', 'products_raw', 'products_mapped', 'activity_logs')
  AND schemaname = 'public';

-- List all policies
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies 
WHERE tablename IN ('suppliers', 'field_mappings', 'feed_ingestions', 'products_raw', 'products_mapped', 'activity_logs')
  AND schemaname = 'public'
ORDER BY tablename, policyname;
