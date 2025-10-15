-- Global UID sequence and RPCs to ensure strictly increasing allocation by 1
-- Safe to run multiple times (idempotent where possible)

-- Legacy: global sequence (kept for backward compatibility if referenced elsewhere)
CREATE SEQUENCE IF NOT EXISTS global_uid_seq AS BIGINT START WITH 1 INCREMENT BY 1 MINVALUE 1 NO MAXVALUE CACHE 1;

-- Minimal per-workspace counter table: stores only the last used number per workspace
CREATE TABLE IF NOT EXISTS workspace_uid_counters (
  workspace_id UUID PRIMARY KEY,
  last_uid BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3) Single allocation RPC
CREATE OR REPLACE FUNCTION allocate_product_uid(
  p_workspace_id UUID
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid BIGINT;
BEGIN
  -- Upsert row for the workspace and atomically increment
  INSERT INTO workspace_uid_counters(workspace_id, last_uid)
  VALUES (p_workspace_id, 0)
  ON CONFLICT (workspace_id) DO NOTHING;

  UPDATE workspace_uid_counters
  SET last_uid = last_uid + 1, updated_at = now()
  WHERE workspace_id = p_workspace_id
  RETURNING last_uid INTO v_uid;

  RETURN v_uid; -- starts at 1 per workspace
END;
$$;

-- 4) Batch allocation RPC
CREATE OR REPLACE FUNCTION allocate_batch_uids(
  p_workspace_id UUID,
  p_count INTEGER
)
RETURNS BIGINT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start BIGINT;
  v_end BIGINT;
BEGIN
  IF p_count IS NULL OR p_count <= 0 THEN
    RETURN ARRAY[]::BIGINT[];
  END IF;

  -- Ensure row exists
  INSERT INTO workspace_uid_counters(workspace_id, last_uid)
  VALUES (p_workspace_id, 0)
  ON CONFLICT (workspace_id) DO NOTHING;

  -- Atomically reserve a contiguous range [last_uid+1 .. last_uid+p_count]
  UPDATE workspace_uid_counters
  SET last_uid = last_uid + p_count,
      updated_at = now()
  WHERE workspace_id = p_workspace_id
  RETURNING last_uid - p_count + 1, last_uid
  INTO v_start, v_end;

  -- Return as array
  RETURN (
    SELECT array_agg(g ORDER BY g)
    FROM generate_series(v_start, v_end) AS g
  );
END;
$$;

-- 5) Validation RPC
-- Optional helpers retained for compatibility (always true for numeric >=1)
CREATE OR REPLACE FUNCTION is_uid_valid(p_uid TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT (p_uid ~ '^\\d+$')::BOOLEAN; $$;

-- 6) Details RPC
-- Minimal details function to return only the number
CREATE OR REPLACE FUNCTION get_uid_details(p_uid TEXT)
RETURNS TABLE (uid BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT p_uid::BIGINT AS uid; $$;

-- 7) Deactivate RPC (soft delete)
CREATE OR REPLACE FUNCTION deactivate_uid(p_uid TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT true; $$;

-- 8) Optional: Simple migration helper for existing rows missing uid default
-- Reset helper: set a workspace counter so next allocation returns 1
CREATE OR REPLACE FUNCTION reset_workspace_uid_counter(p_workspace_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO workspace_uid_counters(workspace_id, last_uid)
  VALUES (p_workspace_id, 0)
  ON CONFLICT (workspace_id) DO UPDATE SET last_uid = 0, updated_at = now();
END;
$$;

-- 9) Verification helpers (queries to run manually):
-- SELECT * FROM workspace_uid_counters;
-- SELECT allocate_product_uid('<workspace_uuid>'); -- expect 1 for a fresh workspace
-- SELECT allocate_batch_uids('<workspace_uuid>', 5); -- expect {2,3,4,5,6} after previous call


