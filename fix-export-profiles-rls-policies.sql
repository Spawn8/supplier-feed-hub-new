-- Fix RLS Policies for Export Profiles and Export History
-- Run this SQL in your Supabase SQL editor

-- ==================================================
-- EXPORT_PROFILES TABLE POLICIES
-- ==================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view export profiles in their workspaces" ON export_profiles;
DROP POLICY IF EXISTS "Users can create export profiles in their workspaces" ON export_profiles;
DROP POLICY IF EXISTS "Users can update export profiles in their workspaces" ON export_profiles;
DROP POLICY IF EXISTS "Users can delete export profiles in their workspaces" ON export_profiles;

-- Create new policies for export_profiles
CREATE POLICY "Users can view export profiles in their workspaces" ON export_profiles
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create export profiles in their workspaces" ON export_profiles
    FOR INSERT WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update export profiles in their workspaces" ON export_profiles
    FOR UPDATE USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete export profiles in their workspaces" ON export_profiles
    FOR DELETE USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

-- ==================================================
-- EXPORT_HISTORY TABLE POLICIES
-- ==================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view export history in their workspaces" ON export_history;
DROP POLICY IF EXISTS "Users can create export history in their workspaces" ON export_history;
DROP POLICY IF EXISTS "Users can update export history in their workspaces" ON export_history;
DROP POLICY IF EXISTS "Users can delete export history in their workspaces" ON export_history;

-- Create new policies for export_history
CREATE POLICY "Users can view export history in their workspaces" ON export_history
    FOR SELECT USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can create export history in their workspaces" ON export_history
    FOR INSERT WITH CHECK (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update export history in their workspaces" ON export_history
    FOR UPDATE USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete export history in their workspaces" ON export_history
    FOR DELETE USING (
        workspace_id IN (
            SELECT workspace_id FROM workspace_members 
            WHERE user_id = auth.uid()
        )
    );

-- ==================================================
-- VERIFICATION QUERIES
-- ==================================================

-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('export_profiles', 'export_history')
  AND schemaname = 'public';

-- List all policies for export tables
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies 
WHERE tablename IN ('export_profiles', 'export_history')
  AND schemaname = 'public'
ORDER BY tablename, policyname;

