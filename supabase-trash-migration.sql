ALTER TABLE projects ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE tasks    ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
