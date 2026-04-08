-- Add project_id and hidden_from_sidebar to channels
alter table public.channels
  add column if not exists project_id text references public.projects(id) on delete set null,
  add column if not exists hidden_from_sidebar boolean not null default false;
