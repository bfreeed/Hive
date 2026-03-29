-- Add Google Drive folder fields to projects table
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS google_drive_folder_id text,
  ADD COLUMN IF NOT EXISTS google_drive_folder_name text;
