-- Folder support for projects sidebar
-- Run this in Supabase SQL editor

ALTER TABLE projects ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_folder boolean NOT NULL DEFAULT false;
