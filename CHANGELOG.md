# Changelog

All notable changes to Hive are documented here.

## [0.1.0] - 2026-03-25

### Added
- **NLP Quick Capture** — `Cmd+K` → type a sentence → "✨ Create with AI" parses it via Claude Haiku into a structured task. Editable confirmation form shows title, due date/time, priority, assignee, project, and reminder before creating.
- **Multi-user reminders** — Pushover notifications sent to all task assignees (falls back to current user for unassigned tasks).
- **Auto-clear reminder on done** — marking a task complete automatically clears `reminderAt` and `reminderSent`, preventing ghost notifications.
- **Vitest test suite** — 33 tests across 3 files covering `storageKeys`, `isInFireWindow`/`getRecipientIds` boundary conditions, and `buildTaskPayload` field mapping.
- **`src/lib/storageKeys.ts`** — centralized localStorage key helpers (DRY across App, useReminderChecker, useHealthSweep).

### Fixed
- **Multi-tab dedup bug** — reminder lock TTL extended from 15s to the full 5-minute fire window, preventing a second browser tab from re-firing the same reminder.
- **Claude JSON markdown wrapping** — `/api/parse-task` now strips ` ```json ``` ` fences from Claude's response before parsing.
- **Accidental assignee matching** — Claude prompt updated to only assign users when explicitly instructed ("assign to X"), not when a name appears in the task description.
- **QuickCapture cancel button** — Escape key now closes the modal from any field (date pickers, dropdowns) via a window-level listener.

### Removed
- **Twilio dependency** — removed dead `twilio` package (replaced by Pushover months ago).

### Infrastructure
- `POST /api/parse-task` Vite middleware — server-side Claude Haiku proxy keeps API key out of the browser bundle.
- `vitest.config.ts` — jsdom test environment configured.
