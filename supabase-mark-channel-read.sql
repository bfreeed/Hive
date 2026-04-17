-- ============================================================
-- Fix: atomic per-user read position merge
-- Run this in Supabase SQL Editor → Run
-- ============================================================
-- Previously, setActiveChannel replaced the entire read_by object,
-- wiping other users' read positions. This RPC merges only the
-- calling user's entry, leaving everyone else's untouched.

CREATE OR REPLACE FUNCTION mark_channel_read(
  p_channel_id text,
  p_user_id    text,
  p_read_at    text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE channels
  SET read_by = COALESCE(read_by, '{}'::jsonb) || jsonb_build_object(p_user_id, p_read_at)
  WHERE id = p_channel_id;
$$;
