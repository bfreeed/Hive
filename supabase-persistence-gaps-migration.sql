-- Fix persistence gaps: add missing columns across tables
-- Run this in Supabase SQL Editor

-- 1. Tasks: subtask parent, section, dependencies
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS parent_id text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS section_id text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS depends_on text[] DEFAULT '{}';

-- 2. Projects: sidebar visibility (also in separate migration, safe to re-run)
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS hide_from_sidebar boolean DEFAULT false;

-- 3. Notifications: invitation link
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS invitation_id text;
