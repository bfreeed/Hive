# Hive Security Report
*Last updated: April 3, 2026 (rev 2)*

---

## Overview

Hive is a multi-user personal task OS built on React (Vite), Supabase (PostgreSQL + Auth), and deployed on Vercel. This document summarizes the security posture of the app — what has been hardened, what remains a known risk, and what is acceptable given the current architecture.

---

## What Has Been Fixed

### 1. Row Level Security (RLS) — Database Access Control
**Was:** All Supabase tables used `USING (true)` — any authenticated user could read and write every other user's data.

**Fixed:** Each table now enforces user-scoped access:

| Table | Policy |
|---|---|
| projects | Only members (`member_ids`) can read/write |
| tasks | Only assignees or project members can read/write |
| channels | Only members (`member_ids`) can read/write |
| messages | Only channel members can read; only authors can edit/delete |
| contacts | Owner only (`user_id`) |
| meetings | Owner only (`user_id`) |
| user_settings | Owner only (`user_id`) |
| user_preferences | Owner only (`user_id`) |
| notifications | Recipient only (`user_id`) |
| profiles | Anyone authenticated can read (needed for teammate names); only self can write |

Each user's data is fully isolated by default. Data is only shared when a user is explicitly added to a project or channel.

---

### 2. API Keys Moved Server-Side
**Was:** The Anthropic (Claude) API key was stored in `localStorage` and sent directly from the browser to Anthropic's API. Visible in DevTools to anyone with physical access to the browser.

**Fixed:** All AI API calls now go through Vercel serverless functions (`/api/*.ts`). The functions:
- Verify the user's Supabase auth token on every request
- Fetch the user's API keys from Supabase `user_settings` (server-side, RLS-protected)
- Make the API call and return only the result — keys never reach the browser

Each user uses their own Anthropic API key configured in Settings. Nobody shares costs or credentials.

---

### 3. Serverless Functions for All Third-Party API Calls
**Was:** All server-side logic lived in Vite dev server middleware (`vite.config.ts`), which only ran locally. All AI features (task parsing, Granola sync, meeting intelligence, etc.) silently failed on Vercel in production.

**Fixed:** Seven endpoints migrated to Vercel serverless functions:
- `/api/parse-task` — natural language task creation
- `/api/sync-granola` — Granola meeting sync
- `/api/link-meeting` — AI meeting → project linking and action item extraction
- `/api/hive-query` — natural language queries across tasks/meetings/projects
- `/api/layout-command` — natural language Home layout changes
- `/api/meeting-intelligence` — meeting Q&A
- `/api/send-notification` — Pushover notifications

All functions require a valid Supabase Bearer token. Unauthenticated requests return 401.

---

### 4. Proper UUID Generation
**Was:** All IDs (tasks, projects, contacts, etc.) were generated with `Math.random().toString(36).slice(2, 9)` — 7 random characters with ~78 billion possible values. Collision risk grows with data volume.

**Fixed:** `uid()` now uses `crypto.randomUUID()` — the browser's built-in cryptographically secure UUID generator with 2¹²² possible values. Collision probability is effectively zero.

---

### 5. Contacts Scoped to Owner
**Was:** All contacts were readable and writable by any authenticated user. No ownership model.

**Fixed:** Added `user_id` column to contacts table. Each user sees only their own contacts. RLS enforces this at the database level.

---

### 6. Messaging — Real-Time Subscription Hardened
**Was:** The Supabase real-time subscription for messages listened to all message events on the table with no channel filter. Any message inserted anywhere could potentially be pushed to a connected client.

**Fixed:** Each real-time event handler now checks that the message's `channelId` is in the current user's channel list before applying it to state. Combined with the RLS policy (channel members only), messages are now protected at two independent layers: database enforcement and client-side guard.

Also fixed:
- `sendMessage` now enforces a 10,000 character limit per message — prevents abuse via oversized payloads
- `updateMessage` now verifies the current user is the message author before allowing any edit — prevents one user from overwriting another's messages (RLS also enforces this at the DB level)

---

### 7. Google API Key Domain Restriction
The Google API key used for Drive/Calendar integration is restricted to:
- `http://localhost:5173/*` (local dev)
- `https://hive-seven-lime.vercel.app/*` (production)

Even if the key were extracted from the browser, it cannot be used from any other domain.

---

## Known Risks (Accepted or Low Priority)

### Google OAuth Tokens in Memory
Google Calendar and Drive use OAuth 2.0 access tokens obtained via Google's popup flow. These tokens live in JavaScript memory (module-level variables) — not in localStorage or cookies. They expire in ~1 hour. This is Google's recommended approach for browser-based apps and is considered acceptable.

The Google Client ID is stored in `localStorage`. Client IDs are designed to be public — they appear in every web page that uses Google Sign-In — so this is not a security concern.

### Profiles Readable by All Authenticated Users
Any signed-in Hive user can read any other user's profile (name, email, avatar). This is a deliberate trade-off: when you're added to a shared project, the app needs to display your teammate's name and avatar. Restricting this further would require a more complex architecture (e.g. only allowing profile reads for users who share a project or channel).

For a small team app this is acceptable. For a larger multi-tenant deployment, profiles should be restricted to mutual project/channel members only.

### Contacts Not Shared Across Users
Contacts are currently per-user. If Lev and Sarah both work with the same external contact, they each maintain their own separate contact record. There is no shared contact model. This is a product limitation more than a security issue, but worth noting.

### Pushover User Keys in localStorage
Pushover notification keys (used for task reminders) are stored in `localStorage` keyed by user ID. These keys can send push notifications to a user's device. Risk is low — someone would need physical access to the browser or an XSS vector, and the worst outcome is receiving an unwanted notification.

### No Rate Limiting on Serverless Functions
The `/api/*` functions have no rate limiting. A malicious authenticated user could call them in a loop and generate API costs on other users' Anthropic keys. For a small team this is acceptable. At scale, rate limiting per user per endpoint should be added.

### Storage Bucket is Public
File attachments (audio notes, task attachments, message attachments) are uploaded to a Supabase Storage bucket configured as public. This means any file URL is accessible to anyone who has it — there is no authentication check on file downloads.

**Risk:** If a file URL were shared outside the app or guessed, the file would be accessible. In practice, all file paths include a UUID making them unguessable.

**Proper fix:** Switch the bucket to private and generate short-lived signed URLs when displaying files. This would require changes to all file display logic across the app. Deferred for now given the low practical risk with UUID-based paths.

---

### Input Not Sanitized Before Sending to Claude
User-provided text (task titles, meeting notes, questions) is passed directly into Claude prompts without sanitization. A sophisticated user could attempt prompt injection — crafting input designed to manipulate Claude's response. The practical impact is low (Claude's responses only affect UI state, not server-side data), but worth monitoring.

---

## Environment Variables

| Variable | Where stored | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Vercel env | Supabase project URL (public) |
| `VITE_SUPABASE_ANON_KEY` | Vercel env | Supabase anon key (public, safe) |
| `SUPABASE_URL` | Vercel env | Same URL for serverless functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env | Admin DB access for serverless functions — never sent to browser |
| `PUSHOVER_API_TOKEN` | `.env.local` only | Not in use; can be added to Vercel if Pushover is re-enabled |
| Anthropic API key | Supabase `user_settings` | Per-user; fetched server-side only |
| Granola API key | Supabase `user_settings` | Per-user; fetched server-side only |
| Google Client ID | Supabase `user_settings` | Per-user; public identifier, safe in browser |
| Google API key | User's browser (localStorage) | Restricted by domain in Google Cloud Console |

---

## Summary

| Area | Status |
|---|---|
| Database access control (RLS) | Hardened |
| AI API keys | Server-side only |
| Google OAuth tokens | In-memory (correct approach) |
| Google API key | Domain-restricted |
| ID generation | Cryptographically secure UUIDs |
| Contact ownership | Per-user |
| Auth on API endpoints | Required (Supabase JWT) |
| Rate limiting | Not implemented |
| Prompt injection protection | Not implemented |
| Profile visibility | Open to all authenticated users |
| Real-time message subscription | Channel-membership guarded |
| Message size limit | 10,000 characters enforced |
| Message edit authorization | Author-only (client + DB) |
| Storage bucket | Public (UUID paths mitigate risk) |
