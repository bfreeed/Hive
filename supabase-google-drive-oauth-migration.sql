-- Server-side Google Drive OAuth token storage
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS google_drive_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS google_drive_access_token TEXT,
  ADD COLUMN IF NOT EXISTS google_drive_token_expiry BIGINT,
  ADD COLUMN IF NOT EXISTS google_oauth_state TEXT;
