-- Update suppliers with null UIDs to have sequential numbers
-- This script assigns UIDs to existing suppliers that don't have them

WITH ranked_suppliers AS (
  SELECT 
    id,
    workspace_id,
    ROW_NUMBER() OVER (PARTITION BY workspace_id ORDER BY creation_completed_at ASC, created_at ASC) as new_uid
  FROM suppliers
  WHERE uid IS NULL
)
UPDATE suppliers 
SET uid = ranked_suppliers.new_uid::text
FROM ranked_suppliers 
WHERE suppliers.id = ranked_suppliers.id;

-- Verify the update
SELECT workspace_id, COUNT(*) as suppliers_with_uid 
FROM suppliers 
WHERE uid IS NOT NULL 
GROUP BY workspace_id;
