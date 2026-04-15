-- ============================================================
-- Hive Isolation Fix Migration
-- Fixes multi-user data isolation issues.
-- Run this in Supabase Dashboard → SQL Editor.
-- Safe to re-run (all operations use IF NOT EXISTS / IF EXISTS).
-- ============================================================

-- ── STEP 1: Add channel project columns ──────────────────────
-- Required for the linked project-channel feature.
ALTER TABLE public.channels
  ADD COLUMN IF NOT EXISTS project_id text REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hidden_from_sidebar boolean NOT NULL DEFAULT false;


-- ── STEP 2: Tighten RLS policies ─────────────────────────────

-- PROFILES — anyone authenticated can read (needed for teammate names).
-- Only you can write your own profile.
DROP POLICY IF EXISTS "profiles: auth read/write" ON profiles;
DROP POLICY IF EXISTS "profiles: authenticated can read" ON profiles;
DROP POLICY IF EXISTS "profiles: own write only" ON profiles;
DROP POLICY IF EXISTS "profiles: own update only" ON profiles;
DROP POLICY IF EXISTS "profiles: own delete only" ON profiles;

CREATE POLICY "profiles: authenticated can read"
  ON profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles: own write only"
  ON profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE POLICY "profiles: own update only"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "profiles: own delete only"
  ON profiles FOR DELETE TO authenticated USING (id = auth.uid());


-- PROJECTS — only members can read/write.
-- NOTE: The accept-invitation API uses service-role key to add new members,
-- so bypassing this policy server-side is safe.
DROP POLICY IF EXISTS "projects: auth read/write" ON projects;
DROP POLICY IF EXISTS "projects: members only" ON projects;

CREATE POLICY "projects: members only"
  ON projects FOR ALL TO authenticated
  USING (auth.uid()::text = ANY(member_ids))
  WITH CHECK (auth.uid()::text = ANY(member_ids));


-- TASKS — visible to assignees OR members of any linked project.
DROP POLICY IF EXISTS "tasks: auth read/write" ON tasks;
DROP POLICY IF EXISTS "tasks: assignee or project member" ON tasks;

CREATE POLICY "tasks: assignee or project member"
  ON tasks FOR ALL TO authenticated
  USING (
    auth.uid()::text = ANY(assignee_ids)
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = ANY(tasks.project_ids)
        AND auth.uid()::text = ANY(p.member_ids)
    )
  )
  WITH CHECK (
    auth.uid()::text = ANY(assignee_ids)
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = ANY(tasks.project_ids)
        AND auth.uid()::text = ANY(p.member_ids)
    )
  );


-- CONTACTS — personal, each user owns their own.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Claim unowned contacts (single-user migration safety net)
UPDATE contacts
SET user_id = (SELECT id FROM profiles WHERE role = 'owner' LIMIT 1)
WHERE user_id IS NULL;

DROP POLICY IF EXISTS "contacts: auth read/write" ON contacts;
DROP POLICY IF EXISTS "contacts: own only" ON contacts;

CREATE POLICY "contacts: own only"
  ON contacts FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- CHANNELS — only members can read/write.
-- The accept-invitation API adds new members server-side (bypasses RLS).
DROP POLICY IF EXISTS "channels: auth read/write" ON channels;
DROP POLICY IF EXISTS "channels: members only" ON channels;

CREATE POLICY "channels: members only"
  ON channels FOR ALL TO authenticated
  USING (auth.uid()::text = ANY(member_ids))
  WITH CHECK (auth.uid()::text = ANY(member_ids));


-- MESSAGES — read if channel member; write own messages in member channels.
DROP POLICY IF EXISTS "messages: auth read/write" ON messages;
DROP POLICY IF EXISTS "messages: read if channel member" ON messages;
DROP POLICY IF EXISTS "messages: send if channel member" ON messages;
DROP POLICY IF EXISTS "messages: edit own" ON messages;
DROP POLICY IF EXISTS "messages: delete own" ON messages;

CREATE POLICY "messages: read if channel member"
  ON messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM channels c
      WHERE c.id = messages.channel_id
        AND auth.uid()::text = ANY(c.member_ids)
    )
  );

CREATE POLICY "messages: send if channel member"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid()::text = author_id
    AND EXISTS (
      SELECT 1 FROM channels c
      WHERE c.id = messages.channel_id
        AND auth.uid()::text = ANY(c.member_ids)
    )
  );

CREATE POLICY "messages: edit own"
  ON messages FOR UPDATE TO authenticated USING (auth.uid()::text = author_id);

CREATE POLICY "messages: delete own"
  ON messages FOR DELETE TO authenticated USING (auth.uid()::text = author_id);


-- NOTIFICATIONS — personal.
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

DROP POLICY IF EXISTS "notifications: auth read/write" ON notifications;
DROP POLICY IF EXISTS "notifications: read own" ON notifications;
DROP POLICY IF EXISTS "notifications: insert any auth" ON notifications;
DROP POLICY IF EXISTS "notifications: update own" ON notifications;
DROP POLICY IF EXISTS "notifications: delete own" ON notifications;

CREATE POLICY "notifications: read own"
  ON notifications FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Any authenticated user (or service role) can insert notifications for others.
CREATE POLICY "notifications: insert any auth"
  ON notifications FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "notifications: update own"
  ON notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "notifications: delete own"
  ON notifications FOR DELETE TO authenticated USING (user_id = auth.uid());


-- USER PREFERENCES — strictly personal.
DROP POLICY IF EXISTS "user_preferences: auth read/write" ON user_preferences;
DROP POLICY IF EXISTS "user_preferences: own only" ON user_preferences;

CREATE POLICY "user_preferences: own only"
  ON user_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- MEETINGS — personal (user_id column already present).
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "meetings: auth read/write" ON meetings;
DROP POLICY IF EXISTS "meetings: own only" ON meetings;

CREATE POLICY "meetings: own only"
  ON meetings FOR ALL TO authenticated
  USING (user_id::text = auth.uid()::text)
  WITH CHECK (user_id::text = auth.uid()::text);


-- USER SETTINGS — personal.
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_settings: auth read/write" ON user_settings;
DROP POLICY IF EXISTS "user_settings: own only" ON user_settings;

CREATE POLICY "user_settings: own only"
  ON user_settings FOR ALL TO authenticated
  USING (user_id::text = auth.uid()::text)
  WITH CHECK (user_id::text = auth.uid()::text);
