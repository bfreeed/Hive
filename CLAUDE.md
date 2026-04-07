# Hive — Claude Project Context

## Project
The app is called **Hive**. A personal task OS built with React/Vite/TypeScript/Tailwind/Supabase/Zustand.
- Source: `~/task-os-2`
- GitHub: `github.com/bfreeed/Hive` (private)
- Deployed on Vercel (auto-deploy on push to main)

## User Preferences
- Communication: Direct, no fluff. Short responses unless depth is needed.
- No emojis unless asked.
- Non-technical — works with Claude Code as the builder.
- Taste: Linear.app-level polish. Todoist simplicity. Hates Notion clunkiness.

## Tech Stack
- React + Vite + TypeScript + Tailwind CSS
- Zustand for state management (`src/store/index.ts`)
- Supabase for auth + database
- Vercel for deployment
- Vite middleware for server-side API calls (Granola sync, Claude AI, Pushover notifications)

## Key Architecture Notes
- `src/store/index.ts` — single Zustand store, all state + Supabase queries
- `src/types/index.ts` — all TypeScript types
- `vite.config.ts` — Vite middleware for `/api/*` endpoints (dev only; Vercel uses separate functions)
- `loadData()` filters all queries by authenticated user's UUID at the DB level
- `currentUser.id` starts as placeholder `'__loading__'` before auth loads — always resolve real UUID before DB writes
- No hardcoded users — all users come from Supabase profiles. No seed data.
- Supabase auth uses `getSession()` (not `getUser()`) for reliability

## Database
- Supabase project (credentials in `.env`)
- RLS enabled on all tables with `using (true)` for authenticated users
- Key tables: `profiles`, `tasks`, `projects`, `channels`, `messages`, `meetings`, `pages`, `user_settings`, `user_preferences`

## Granola Integration
- Granola API key stored in `user_settings.granola_api_key`
- Sync via `/api/sync-granola` Vite middleware (dev) + `useGranolaSync` hook (polls every 15 min)
- "Sync Now" button in Settings → Integrations → Granola
- Action items extracted via Claude (`/api/link-meeting`) for all participants
- `granolaLastSyncedAt` cleared on key save or manual sync to force full re-fetch

## Vercel Serverless Functions
- Hobby plan limit: **12 functions max**. Currently at 12. Do NOT add new `api/*.ts` files without consolidating.
- Helper/shared code goes in `api/_lib/` — the `_` prefix tells Vercel not to count it as a function.
- Imports from `_lib` must use `.js` extension for ESM resolution: `from './_lib/auth.js'`
- Never rename `_lib` to `lib` — that breaks the function count.
- Vercel project name is **Hive** (not task-os-2). Don't run `vercel link` — it can create duplicate projects.

## Google Drive Integration
- Server-side OAuth 2.0 with refresh tokens stored in Supabase `user_settings`
- Endpoints: `google-drive-initiate`, `google-drive-callback`, `google-drive-token`, `google-drive-files`
- Requires env vars on Vercel: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

## Pending Backlog
1. Update pitch deck with Smart Messaging section
2. Improve workspace templates
3. Fix workspace/docs tab sharing same docContent field
4. Remove debug console.log from vite.config.ts sync endpoint

## Supabase Migrations Run
- `supabase-drive-migration.sql` — adds google_drive_folder_id, google_drive_folder_name to projects
- `supabase-google-client-id-migration.sql` — adds google_client_id to user_settings
- `supabase-message-priority-migration.sql` — adds priority, receiver_priority to messages

## gstack Skills
Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available gstack skills:
- `/office-hours` `/plan-ceo-review` `/plan-eng-review` `/plan-design-review`
- `/design-consultation` `/review` `/ship` `/browse` `/qa` `/qa-only`
- `/design-review` `/setup-browser-cookies` `/retro` `/investigate`
- `/document-release` `/codex` `/careful` `/freeze` `/guard` `/unfreeze` `/gstack-upgrade`
