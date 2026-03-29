ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS priority text,
  ADD COLUMN IF NOT EXISTS receiver_priority text;
