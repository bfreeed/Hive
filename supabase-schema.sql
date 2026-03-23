-- ============================================================
-- Hive Task OS — Supabase Schema
-- Run this in the Supabase Dashboard → SQL Editor
-- ============================================================

-- PROFILES
-- Linked 1:1 to auth.users via UUID
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null default '',
  email       text not null default '',
  avatar      text,
  role        text not null default 'owner',
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "profiles: auth read/write"
  on public.profiles for all
  to authenticated
  using (true)
  with check (true);

-- Auto-create profile on sign up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    'owner'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- PROJECTS
create table if not exists public.projects (
  id          text primary key,
  name        text not null,
  description text,
  color       text not null default '#6366f1',
  icon        text,
  status      text not null default 'active',
  member_ids  text[] not null default '{}',
  is_private  boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.projects enable row level security;
create policy "projects: auth read/write"
  on public.projects for all
  to authenticated
  using (true)
  with check (true);

-- TASKS
create table if not exists public.tasks (
  id                    text primary key,
  title                 text not null,
  description           text,
  project_ids           text[] not null default '{}',
  status                text not null default 'todo',
  priority              text not null default 'medium',
  assignee_ids          text[] not null default '{}',
  due_date              text,
  due_time              text,
  due_time_end          text,
  calendar_event_id     text,
  calendar_show_as      text,
  calendar_sync         boolean not null default true,
  snooze_date           text,
  wait_date             text,
  label                 text,
  recurring             text,
  is_private            boolean not null default false,
  within_72_hours       boolean not null default false,
  questions_for_lev     boolean not null default false,
  update_at_checkin     boolean not null default false,
  linked_contact_ids    text[] not null default '{}',
  linked_doc_ids        text[] not null default '{}',
  comments              jsonb not null default '[]',
  audio_notes           jsonb not null default '[]',
  attachments           jsonb not null default '[]',
  reminder_at           timestamptz,
  reminder_sent         boolean not null default false,
  completed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

alter table public.tasks enable row level security;
create policy "tasks: auth read/write"
  on public.tasks for all
  to authenticated
  using (true)
  with check (true);

-- CONTACTS
create table if not exists public.contacts (
  id               text primary key,
  name             text not null,
  email            text,
  phone            text,
  avatar           text,
  project_ids      text[] not null default '{}',
  notes            text,
  booking_link     text,
  meetings         jsonb not null default '[]',
  linked_task_ids  text[] not null default '{}'
);

alter table public.contacts enable row level security;
create policy "contacts: auth read/write"
  on public.contacts for all
  to authenticated
  using (true)
  with check (true);

-- CHANNELS
create table if not exists public.channels (
  id           text primary key,
  name         text not null,
  type         text not null default 'channel',
  member_ids   text[] not null default '{}',
  description  text,
  last_read_at timestamptz
);

alter table public.channels enable row level security;
create policy "channels: auth read/write"
  on public.channels for all
  to authenticated
  using (true)
  with check (true);

-- MESSAGES
create table if not exists public.messages (
  id          text primary key,
  channel_id  text not null references public.channels(id) on delete cascade,
  author_id   text not null,
  body        text not null,
  reactions   jsonb not null default '{}',
  attachments jsonb,
  edited_at   timestamptz,
  parent_id   text,
  created_at  timestamptz not null default now()
);

alter table public.messages enable row level security;
create policy "messages: auth read/write"
  on public.messages for all
  to authenticated
  using (true)
  with check (true);

-- NOTIFICATIONS
create table if not exists public.notifications (
  id          text primary key,
  type        text not null,
  title       text not null,
  body        text not null,
  task_id     text,
  project_id  text,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.notifications enable row level security;
create policy "notifications: auth read/write"
  on public.notifications for all
  to authenticated
  using (true)
  with check (true);

-- USER PREFERENCES
create table if not exists public.user_preferences (
  user_id       uuid primary key references public.profiles(id) on delete cascade,
  manual_order  text[] not null default '{}'
);

alter table public.user_preferences enable row level security;
create policy "user_preferences: auth read/write"
  on public.user_preferences for all
  to authenticated
  using (true)
  with check (true);
