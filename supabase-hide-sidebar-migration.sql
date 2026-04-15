-- Add hide_from_sidebar column to projects table
-- This persists the per-project sidebar visibility toggle (used for sub-projects)
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS hide_from_sidebar boolean DEFAULT false;
