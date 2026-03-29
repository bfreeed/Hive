ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS calendar_id text;
