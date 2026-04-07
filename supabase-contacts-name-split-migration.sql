-- Split contacts.name into first_name + last_name
-- Run in Supabase SQL Editor

-- Add new columns
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

-- Migrate existing data: split name on first space
UPDATE contacts
SET
  first_name = CASE
    WHEN name IS NOT NULL AND position(' ' in name) > 0 THEN left(name, position(' ' in name) - 1)
    ELSE COALESCE(name, '')
  END,
  last_name = CASE
    WHEN name IS NOT NULL AND position(' ' in name) > 0 THEN substring(name from position(' ' in name) + 1)
    ELSE ''
  END
WHERE first_name IS NULL;

-- Make first_name required, default last_name to empty string
ALTER TABLE contacts
  ALTER COLUMN first_name SET NOT NULL,
  ALTER COLUMN first_name SET DEFAULT '',
  ALTER COLUMN last_name SET NOT NULL,
  ALTER COLUMN last_name SET DEFAULT '';

-- Drop the old name column
ALTER TABLE contacts DROP COLUMN IF EXISTS name;
