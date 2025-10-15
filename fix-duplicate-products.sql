-- Fix duplicate products in products_mapped table
-- This script will remove duplicate entries and keep only the latest ones

-- First, let's see what we have
SELECT 
  supplier_id,
  uid,
  COUNT(*) as count,
  MIN(imported_at) as first_import,
  MAX(imported_at) as last_import
FROM products_mapped 
GROUP BY supplier_id, uid 
HAVING COUNT(*) > 1
ORDER BY supplier_id, uid;

-- Delete duplicate entries, keeping only the latest one for each supplier_id + uid combination
WITH ranked_products AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY supplier_id, uid 
      ORDER BY imported_at DESC, id DESC
    ) as rn
  FROM products_mapped
)
DELETE FROM products_mapped 
WHERE id IN (
  SELECT id FROM ranked_products WHERE rn > 1
);

-- Verify the cleanup
SELECT 
  supplier_id,
  uid,
  COUNT(*) as count
FROM products_mapped 
GROUP BY supplier_id, uid 
HAVING COUNT(*) > 1;
