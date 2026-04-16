-- ============================================================
-- CRITICAL: Task isolation fix
-- Run this in Supabase SQL Editor → Run
-- ============================================================

-- 1. Enable RLS on tasks (in case it was off)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- 2. Drop any existing task policies to start clean
DROP POLICY IF EXISTS "tasks_select" ON tasks;
DROP POLICY IF EXISTS "tasks_insert" ON tasks;
DROP POLICY IF EXISTS "tasks_update" ON tasks;
DROP POLICY IF EXISTS "tasks_delete" ON tasks;
DROP POLICY IF EXISTS "Users can view their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can insert their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can update their own tasks" ON tasks;
DROP POLICY IF EXISTS "Users can delete their own tasks" ON tasks;

-- 3. SELECT: visible if you are an assignee OR the task is in one of your projects
CREATE POLICY "tasks_select" ON tasks
  FOR SELECT USING (
    auth.uid()::text = ANY(assignee_ids)
    OR EXISTS (
      SELECT 1 FROM projects
      WHERE id = ANY(tasks.project_ids)
      AND auth.uid()::text = ANY(member_ids)
    )
  );

-- 4. INSERT: you must be an assignee on anything you create
CREATE POLICY "tasks_insert" ON tasks
  FOR INSERT WITH CHECK (
    auth.uid()::text = ANY(assignee_ids)
  );

-- 5. UPDATE: you must be an assignee
CREATE POLICY "tasks_update" ON tasks
  FOR UPDATE USING (
    auth.uid()::text = ANY(assignee_ids)
  );

-- 6. DELETE: you must be an assignee
CREATE POLICY "tasks_delete" ON tasks
  FOR DELETE USING (
    auth.uid()::text = ANY(assignee_ids)
  );

-- 7. Verify: should return only YOUR tasks when run as your user
-- (uncomment and run separately to check)
-- SELECT id, title, assignee_ids FROM tasks LIMIT 20;
