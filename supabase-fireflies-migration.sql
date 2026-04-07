-- Add Fireflies integration columns to user_settings
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS fireflies_api_key text,
  ADD COLUMN IF NOT EXISTS fireflies_last_synced_at timestamptz;
