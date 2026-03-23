-- Migration: Replace per-task flag booleans with a flexible per-user flag system
-- Run this in the Supabase SQL editor

-- 1. Add flags jsonb column to profiles (stores each user's flag definitions)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS flags jsonb DEFAULT '[]'::jsonb;

-- 2. Add flags jsonb column to tasks (stores {flagId, appliedBy} entries)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS flags jsonb DEFAULT '[]'::jsonb;

-- 3. Migrate existing task booleans into the new flags format
-- using Lev's default flag IDs
UPDATE tasks
SET flags = (
  SELECT jsonb_agg(entry)
  FROM (
    SELECT jsonb_build_object('flagId', 'flag-72h', 'appliedBy', 'lev') AS entry
    WHERE within_72_hours = true
    UNION ALL
    SELECT jsonb_build_object('flagId', 'flag-questions', 'appliedBy', 'lev') AS entry
    WHERE questions_for_lev = true
    UNION ALL
    SELECT jsonb_build_object('flagId', 'flag-checkin', 'appliedBy', 'lev') AS entry
    WHERE update_at_checkin = true
  ) AS entries
)
WHERE within_72_hours = true OR questions_for_lev = true OR update_at_checkin = true;

-- 4. Set default flags on all existing profiles
UPDATE profiles
SET flags = '[
  {"id":"flag-72h","name":"72h Priority","color":"#ef4444"},
  {"id":"flag-questions","name":"Questions for Me","color":"#a855f7"},
  {"id":"flag-checkin","name":"Update at Checkin","color":"#10b981"}
]'::jsonb
WHERE flags = '[]'::jsonb OR flags IS NULL;

-- 5. Drop old boolean columns (optional — comment out to keep them as backup)
-- ALTER TABLE tasks DROP COLUMN IF EXISTS within_72_hours;
-- ALTER TABLE tasks DROP COLUMN IF EXISTS questions_for_lev;
-- ALTER TABLE tasks DROP COLUMN IF EXISTS update_at_checkin;
