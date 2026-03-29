-- Pages table for Hive Workspace
CREATE TABLE IF NOT EXISTS pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Untitled',
  icon text,
  content jsonb DEFAULT '{}',
  parent_id uuid REFERENCES pages(id) ON DELETE SET NULL,
  project_id text,
  template_id text,
  is_template boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own pages only" ON pages
  FOR ALL USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS pages_user_parent ON pages(user_id, parent_id);
CREATE INDEX IF NOT EXISTS pages_project ON pages(project_id);
CREATE INDEX IF NOT EXISTS pages_updated ON pages(user_id, updated_at DESC);
