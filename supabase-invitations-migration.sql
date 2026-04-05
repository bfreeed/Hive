-- Invitations table
-- Run this in Supabase SQL editor

CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('project', 'channel')),
  resource_id text NOT NULL,
  resource_name text NOT NULL,
  invited_by_user_id text NOT NULL,
  invited_by_name text,
  invited_user_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Invitee and inviter can both read
CREATE POLICY "invitations_select" ON invitations FOR SELECT
  USING (auth.uid()::text = invited_user_id OR auth.uid()::text = invited_by_user_id);

-- Only invitee can respond (update status)
CREATE POLICY "invitations_update" ON invitations FOR UPDATE
  USING (auth.uid()::text = invited_user_id);

-- Service role handles inserts (via /api/send-invitation serverless function)
-- No INSERT policy needed for anon/auth role

-- Add invitation_id column to notifications so we can link them
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS invitation_id uuid REFERENCES invitations(id) ON DELETE CASCADE;

-- Allow any authenticated user to insert notifications
-- (needed so serverless function can post notifications on behalf of inviter → invitee)
-- Service role bypasses RLS so this isn't strictly needed, but good to document intent
