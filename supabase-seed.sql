-- ============================================================
-- Hive Task OS — Seed Data
-- Run AFTER supabase-schema.sql in the Supabase SQL Editor.
-- This inserts the hardcoded demo data so the app isn't empty.
-- NOTE: assignee_ids / member_ids use 'lev' and 'sarah' as
-- placeholder strings. They'll match real profile UUIDs once
-- you update them after signing up.
-- ============================================================

-- PROJECTS
insert into public.projects (id, name, description, color, status, member_ids, is_private, created_at)
values
  ('personal', 'Personal Life',                 'Personal tasks and life admin',   '#6366f1', 'active', array['lev','sarah'], false, now()),
  ('rff',      'Resilient Future Foundation',   'RFF nonprofit work',              '#10b981', 'active', array['lev'],          false, now()),
  ('jedi',     'Jedi Village',                  'Property in Sebastopol',          '#f59e0b', 'active', array['lev'],          false, now())
on conflict (id) do nothing;

-- TASKS
insert into public.tasks
  (id, title, project_ids, status, priority, assignee_ids, within_72_hours, questions_for_lev, update_at_checkin, is_private, linked_contact_ids, linked_doc_ids, comments, audio_notes, attachments, calendar_sync, due_date, created_at, updated_at)
values
  ('t1', 'Fix roof leak',
    array['jedi'], 'todo', 'urgent', array['lev','sarah'],
    true, false, false, false, '{}', '{}', '[]', '[]', '[]', true,
    (now() + interval '2 days')::date::text, now(), now()),

  ('t2', 'Name change with Travis County',
    array['jedi'], 'waiting', 'high', array['lev'],
    false, false, false, false, '{}', '{}', '[]', '[]', '[]', true,
    null, now(), now()),

  ('t3', 'Schedule dentist appointment',
    array['personal'], 'todo', 'medium', array['sarah'],
    false, false, true, false, '{}', '{}', '[]', '[]', '[]', true,
    (now() + interval '7 days')::date::text, now(), now()),

  ('t4', 'Review RFF grant proposal',
    array['rff'], 'review', 'high', array['lev'],
    false, true, false, false, '{}', '{}', '[]', '[]', '[]', true,
    null, now(), now()),

  ('t5', 'Contact storage facility',
    array['jedi'], 'todo', 'medium', array['sarah'],
    false, false, false, false, '{}', '{}', '[]', '[]', '[]', true,
    null, now(), now()),

  ('t6', 'Annual physical checkup',
    array['personal'], 'todo', 'medium', array['lev'],
    false, false, false, true, '{}', '{}', '[]', '[]', '[]', true,
    (now() - interval '1 day')::date::text, now(), now())
on conflict (id) do nothing;

-- CONTACTS
insert into public.contacts (id, name, email, project_ids, notes, meetings, linked_task_ids)
values
  ('c1', 'Sarah',           'sarah@example.com', array['personal','rff','jedi'], 'Personal assistant', '[]', array['t3','t5']),
  ('c2', 'Freddie Kimmel',  null,                array['personal'],              '',                   '[]', '{}'),
  ('c3', 'Daniel Kaminski', null,                array['personal'],              '',                   '[]', '{}')
on conflict (id) do nothing;

-- CHANNELS
insert into public.channels (id, name, type, member_ids, description)
values
  ('general',     'general',        'channel', array['lev','sarah'], 'General updates and announcements'),
  ('jedi-village','jedi-village',   'channel', array['lev','sarah'], 'Jedi Village property updates'),
  ('rff',         'rff-foundation', 'channel', array['lev','sarah'], 'Resilient Future Foundation work'),
  ('dm-sarah',    'Sarah',          'dm',      array['lev','sarah'], null)
on conflict (id) do nothing;

-- MESSAGES
insert into public.messages (id, channel_id, author_id, body, reactions, created_at)
values
  -- #general
  ('m1',  'general',     'sarah', 'Good morning! I have the weekly task summary ready whenever you want to review it.', '{}', now() - interval '2 hours'),
  ('m2',  'general',     'lev',   'Great, send it over. Also can you check on the dentist appointment status?',          '{"👍":["sarah"]}', now() - interval '108 minutes'),
  ('m3',  'general',     'sarah', 'On it. I called and they have availability next Tuesday or Thursday morning.',        '{}', now() - interval '90 minutes'),
  ('m4',  'general',     'lev',   'Thursday works. Book it.',                                                            '{"✅":["sarah"]}', now() - interval '72 minutes'),
  ('m5',  'general',     'sarah', 'Done! Added to your calendar for Thursday 9am. Confirmation sent to your email.',     '{}', now() - interval '60 minutes'),

  -- #jedi-village
  ('m6',  'jedi-village','sarah', 'Heard back from the roofing contractor. They can come out Wednesday between 10am–2pm.', '{}', now() - interval '1 day'),
  ('m7',  'jedi-village','lev',   'Perfect. Make sure someone is there to let them in.',                                   '{}', now() - interval '1 day'),
  ('m8',  'jedi-village','sarah', 'I can be there. Should I get a quote before approving any work?',                       '{}', now() - interval '1 day'),
  ('m9',  'jedi-village','lev',   'Yes — get the quote first, anything under $2k just approve. Over that, send it to me.', '{"👍":["sarah"]}', now() - interval '1 day'),
  ('m10', 'jedi-village','sarah', 'Also the Travis County name change paperwork came back. Looks like we need a notarized signature. Want me to find a mobile notary?', '{}', now() - interval '4 hours'),
  ('m11', 'jedi-village','lev',   'Yes please. Try to find one that can come to me.',                                      '{}', now() - interval '3 hours'),

  -- #rff-foundation
  ('m12', 'rff',         'sarah', 'The grant proposal draft is in your review queue. It is due Friday so wanted to flag it early.', '{}', now() - interval '2 days'),
  ('m13', 'rff',         'lev',   'I saw it. Will review tonight. Any notes from the board?',                                       '{}', now() - interval '2 days'),
  ('m14', 'rff',         'sarah', 'Nothing formal yet. Marcus mentioned they want a stronger impact statement in section 3.',        '{}', now() - interval '2 days'),
  ('m15', 'rff',         'lev',   'Good to know. I will tighten that section.',                                                     '{}', now() - interval '1 day'),

  -- DM - Sarah
  ('m16', 'dm-sarah',    'sarah', 'Hey, quick heads up — the storage facility said they need 30 days notice to cancel. Did you want to keep the unit through April?', '{}', now() - interval '1 day'),
  ('m17', 'dm-sarah',    'lev',   'No let''s cancel it. Start the 30 day notice now.',                                                                               '{}', now() - interval '1 day'),
  ('m18', 'dm-sarah',    'sarah', 'Done. They confirmed cancellation effective April 20th. I will add a task to arrange pickup of anything still there.',             '{"❤️":["lev"]}', now() - interval '1 day'),
  ('m19', 'dm-sarah',    'sarah', 'Also — are we still doing the weekly check-in call on Friday?',                                                                   '{}', now() - interval '30 minutes'),
  ('m20', 'dm-sarah',    'lev',   'Yes, same time. 10am.',                                                                                                           '{}', now() - interval '15 minutes')
on conflict (id) do nothing;
