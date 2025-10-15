-- Workspace-scoped monotonic UID allocator for suppliers
-- Minimal, safe approach: use a single global sequence for supplier UIDs
-- 1) Sequence (idempotent)
CREATE SEQUENCE IF NOT EXISTS supplier_uid_seq;

-- 2) Helper to get next UID
CREATE OR REPLACE FUNCTION get_next_supplier_uid()
RETURNS BIGINT
LANGUAGE sql
AS $$ SELECT nextval('supplier_uid_seq'); $$;

-- 3) Enforce uniqueness on suppliers.uid (text)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_suppliers_uid_idx
ON suppliers(uid)
WHERE uid IS NOT NULL;


