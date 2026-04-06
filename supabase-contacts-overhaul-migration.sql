-- Contacts overhaul: add business, birthday, address, relationship_tag_ids
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS business text,
  ADD COLUMN IF NOT EXISTS birthday text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS relationship_tag_ids text[] DEFAULT '{}';

-- Store relationship tags in user_settings
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS relationship_tags jsonb DEFAULT '[]';
