-- ============================================================
-- GIN Index Migration — speeds up array containment queries
-- Fixes 3-5 second page load caused by full table scans on
-- member_ids / assignee_ids / project_ids columns.
--
-- Run in: Supabase Dashboard → SQL Editor
-- Safe to re-run (uses IF NOT EXISTS).
-- ============================================================

-- Projects: speed up .contains('member_ids', [uid])
CREATE INDEX IF NOT EXISTS projects_member_ids_gin
  ON public.projects USING GIN (member_ids);

-- Channels: speed up .contains('member_ids', [uid])
CREATE INDEX IF NOT EXISTS channels_member_ids_gin
  ON public.channels USING GIN (member_ids);

-- Tasks: speed up .contains('assignee_ids', [uid])
CREATE INDEX IF NOT EXISTS tasks_assignee_ids_gin
  ON public.tasks USING GIN (assignee_ids);

-- Tasks: speed up the RLS policy EXISTS subquery on project_ids
CREATE INDEX IF NOT EXISTS tasks_project_ids_gin
  ON public.tasks USING GIN (project_ids);

-- Projects: help the RLS policy EXISTS subquery (id + member_ids lookup)
CREATE INDEX IF NOT EXISTS projects_id_member_ids_idx
  ON public.projects (id) INCLUDE (member_ids);
