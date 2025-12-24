-- ============================================================================
-- Cleanup Script: Remove products_raw and products_final tables
-- Safe to run - these tables are no longer used in the simplified architecture
-- products_mapped is now the single source of truth
-- ============================================================================

-- First, let's check what we're about to delete (informational only)
-- Run these queries first if you want to see what exists:
/*
SELECT 
    tablename, 
    schemaname 
FROM pg_tables 
WHERE tablename LIKE '%products_raw%' 
   OR tablename LIKE '%products_final%'
ORDER BY tablename;

SELECT 
    viewname, 
    schemaname 
FROM pg_views 
WHERE definition LIKE '%products_final%'
   OR definition LIKE '%products_raw%'
ORDER BY viewname;
*/

-- ============================================================================
-- Step 1: Drop dependent views that reference products_final
-- ============================================================================

DROP VIEW IF EXISTS workspace_dashboard CASCADE;
DROP VIEW IF EXISTS supplier_status CASCADE;

-- ============================================================================
-- Step 2: Drop the unused tables
-- This will automatically drop:
-- - All indexes on these tables
-- - All triggers on these tables  
-- - All RLS policies on these tables
-- - All foreign key constraints FROM these tables
-- ============================================================================

-- Drop products_final table
DROP TABLE IF EXISTS products_final CASCADE;

-- Drop products_raw table
DROP TABLE IF EXISTS products_raw CASCADE;

-- ============================================================================
-- Step 3: Clean up any backup/old versions of these tables
-- Common backup naming patterns
-- ============================================================================

DROP TABLE IF EXISTS products_final_backup CASCADE;
DROP TABLE IF EXISTS products_final_old CASCADE;
DROP TABLE IF EXISTS products_final_bak CASCADE;
DROP TABLE IF EXISTS _products_final_old CASCADE;

DROP TABLE IF EXISTS products_raw_backup CASCADE;
DROP TABLE IF EXISTS products_raw_old CASCADE;
DROP TABLE IF EXISTS products_raw_bak CASCADE;
DROP TABLE IF EXISTS _products_raw_old CASCADE;

-- ============================================================================
-- Step 4: Recreate the workspace_dashboard view WITHOUT products_final
-- Using products_mapped instead
-- ============================================================================

CREATE VIEW workspace_dashboard AS
SELECT 
    w.id,
    w.name,
    w.slug,
    w.billing_plan,
    w.billing_status,
    COUNT(DISTINCT s.id) as supplier_count,
    COUNT(DISTINCT pm.id) as product_count,
    COUNT(DISTINCT ep.id) as export_profile_count,
    MAX(fi.completed_at) as last_sync_at
FROM workspaces w
LEFT JOIN suppliers s ON s.workspace_id = w.id
LEFT JOIN products_mapped pm ON pm.workspace_id = w.id
LEFT JOIN export_profiles ep ON ep.workspace_id = w.id
LEFT JOIN feed_ingestions fi ON fi.workspace_id = w.id
GROUP BY w.id, w.name, w.slug, w.billing_plan, w.billing_status;

-- Recreate supplier_status view (no changes needed, didn't use products tables)
CREATE VIEW supplier_status AS
SELECT 
    s.id,
    s.workspace_id,
    s.name,
    s.source_type,
    s.status,
    s.last_sync_at,
    s.next_sync_at,
    s.error_message,
    fi.status as last_ingestion_status,
    fi.items_total,
    fi.items_success,
    fi.items_errors,
    fi.completed_at as last_ingestion_completed_at
FROM suppliers s
LEFT JOIN LATERAL (
    SELECT * FROM feed_ingestions 
    WHERE supplier_id = s.id 
    ORDER BY started_at DESC 
    LIMIT 1
) fi ON true;

-- ============================================================================
-- Step 5: Update table comments
-- ============================================================================

COMMENT ON TABLE products_mapped IS 'Single source of truth for products - contains mapped and normalized product data from all suppliers';

-- ============================================================================
-- Verification Queries
-- Run these after the cleanup to confirm everything is working:
-- ============================================================================

/*
-- Check that tables are gone
SELECT tablename FROM pg_tables 
WHERE tablename IN ('products_raw', 'products_final')
  AND schemaname = 'public';
-- Should return 0 rows

-- Check that products_mapped still exists and has data
SELECT COUNT(*) FROM products_mapped;
-- Should return your product count

-- Check that views are recreated
SELECT viewname FROM pg_views 
WHERE viewname IN ('workspace_dashboard', 'supplier_status')
  AND schemaname = 'public';
-- Should return 2 rows

-- Check workspace dashboard works
SELECT * FROM workspace_dashboard LIMIT 1;
-- Should return workspace data
*/

-- ============================================================================
-- Rollback (if needed)
-- ============================================================================

/*
-- If you need to recreate these tables for any reason, you can run the 
-- relevant sections from database-schema.sql
-- 
-- However, note that they will be empty and the application no longer 
-- populates them, so this is only useful if you're reverting code changes.
*/

-- ============================================================================
-- Summary
-- ============================================================================

-- This script has:
-- ✅ Dropped the products_final table and all its dependencies
-- ✅ Dropped the products_raw table and all its dependencies  
-- ✅ Cleaned up any backup tables
-- ✅ Recreated views to use products_mapped instead
-- ✅ Updated documentation comments
--
-- The system now uses products_mapped as the single source of truth.
-- All exports, WooCommerce sync, and product queries use products_mapped.





