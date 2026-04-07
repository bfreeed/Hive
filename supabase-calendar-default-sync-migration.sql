-- Add calendar_default_sync preference to user_settings
-- Run in Supabase SQL Editor

ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS calendar_default_sync boolean DEFAULT false;
