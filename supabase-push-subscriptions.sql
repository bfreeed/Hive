-- Push notification subscriptions
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS push_subscriptions (
  user_id   text PRIMARY KEY,
  subscription jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own subscription
DROP POLICY IF EXISTS "push_subscriptions_self" ON push_subscriptions;
CREATE POLICY "push_subscriptions_self" ON push_subscriptions
  FOR ALL USING (auth.uid()::text = user_id);
