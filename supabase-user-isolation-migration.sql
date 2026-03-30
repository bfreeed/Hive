-- User Isolation Migration
-- Replaces legacy 'lev' string IDs with the actual Supabase UUID in
-- member_ids (projects, channels) and assignee_ids (tasks).
-- Run this ONCE in the Supabase SQL editor.

DO $$
DECLARE
  lev_uuid text;
BEGIN
  -- Find Lev's UUID from the profiles table
  SELECT id::text INTO lev_uuid
  FROM profiles
  WHERE email ILIKE '%lev%'
  LIMIT 1;

  IF lev_uuid IS NULL THEN
    RAISE NOTICE 'Could not find a profile with email containing "lev". Skipping migration.';
    RETURN;
  END IF;

  RAISE NOTICE 'Migrating legacy id "lev" → %', lev_uuid;

  -- Projects: replace 'lev' in member_ids array
  UPDATE projects
  SET member_ids = array_replace(member_ids, 'lev', lev_uuid)
  WHERE 'lev' = ANY(member_ids);

  -- Channels: replace 'lev' in member_ids array
  UPDATE channels
  SET member_ids = array_replace(member_ids, 'lev', lev_uuid)
  WHERE 'lev' = ANY(member_ids);

  -- Tasks: replace 'lev' in assignee_ids array
  UPDATE tasks
  SET assignee_ids = array_replace(assignee_ids, 'lev', lev_uuid)
  WHERE 'lev' = ANY(assignee_ids);

  RAISE NOTICE 'Migration complete.';
END $$;
