-- ============================================================
-- Hive RLS Hardening Migration
-- Replaces permissive "using (true)" policies with proper
-- user-scoped access control.
--
-- Run this ONCE in the Supabase Dashboard → SQL Editor.
-- ============================================================

-- ── PROFILES ─────────────────────────────────────────────────
-- Anyone authenticated can read profiles (needed to show teammate names/avatars).
-- Only you can insert or update your own profile.
DROP POLICY IF EXISTS "profiles: auth read/write" ON profiles;

CREATE POLICY "profiles: authenticated can read"
  ON profiles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "profiles: own write only"
  ON profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles: own update only"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE POLICY "profiles: own delete only"
  ON profiles FOR DELETE TO authenticated
  USING (id = auth.uid());


-- ── PROJECTS ─────────────────────────────────────────────────
-- Only project members can read or modify a project.
DROP POLICY IF EXISTS "projects: auth read/write" ON projects;

CREATE POLICY "projects: members only"
  ON projects FOR ALL TO authenticated
  USING (auth.uid()::text = ANY(member_ids))
  WITH CHECK (auth.uid()::text = ANY(member_ids));


-- ── TASKS ────────────────────────────────────────────────────
-- You can see/modify a task if you are an assignee OR a member
-- of one of the projects the task belongs to.
DROP POLICY IF EXISTS "tasks: auth read/write" ON tasks;

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


-- ── CONTACTS ─────────────────────────────────────────────────
-- Each user owns their own contacts. Add user_id column and
-- restrict to owner only.
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Claim any existing contacts that have no owner yet
-- (assigns them to the first owner-role profile found — safe for single-user migration)
UPDATE contacts
SET user_id = (SELECT id FROM profiles WHERE role = 'owner' LIMIT 1)
WHERE user_id IS NULL;

DROP POLICY IF EXISTS "contacts: auth read/write" ON contacts;

CREATE POLICY "contacts: own only"
  ON contacts FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ── CHANNELS ─────────────────────────────────────────────────
-- Only channel members can read or modify a channel.
DROP POLICY IF EXISTS "channels: auth read/write" ON channels;

CREATE POLICY "channels: members only"
  ON channels FOR ALL TO authenticated
  USING (auth.uid()::text = ANY(member_ids))
  WITH CHECK (auth.uid()::text = ANY(member_ids));


-- ── MESSAGES ─────────────────────────────────────────────────
-- Read: must be a member of the message's channel.
-- Write: must be the author and a member of the channel.
-- Edit/delete: own messages only.
DROP POLICY IF EXISTS "messages: auth read/write" ON messages;

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
  ON messages FOR UPDATE TO authenticated
  USING (auth.uid()::text = author_id);

CREATE POLICY "messages: delete own"
  ON messages FOR DELETE TO authenticated
  USING (auth.uid()::text = author_id);


-- ── NOTIFICATIONS ────────────────────────────────────────────
-- Add user_id column if it doesn't exist yet.
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

DROP POLICY IF EXISTS "notifications: auth read/write" ON notifications;

-- Recipients can read and mark their own notifications.
-- Any authenticated user can insert (system fires notifications for others).
CREATE POLICY "notifications: read own"
  ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications: insert any auth"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "notifications: update own"
  ON notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notifications: delete own"
  ON notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());


-- ── USER PREFERENCES ─────────────────────────────────────────
-- Strictly personal — only the owning user can read/write.
DROP POLICY IF EXISTS "user_preferences: auth read/write" ON user_preferences;

CREATE POLICY "user_preferences: own only"
  ON user_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ── MEETINGS ─────────────────────────────────────────────────
-- Meetings are personal (user_id column already present).
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "meetings: auth read/write" ON meetings;

CREATE POLICY "meetings: own only"
  ON meetings FOR ALL TO authenticated
  USING (user_id::text = auth.uid()::text)
  WITH CHECK (user_id::text = auth.uid()::text);


-- ── USER SETTINGS ────────────────────────────────────────────
-- API keys and personal config — strictly personal.
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_settings: auth read/write" ON user_settings;

CREATE POLICY "user_settings: own only"
  ON user_settings FOR ALL TO authenticated
  USING (user_id::text = auth.uid()::text)
  WITH CHECK (user_id::text = auth.uid()::text);
