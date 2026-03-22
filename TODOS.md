# Hive — Deferred Work

## P2 — Recurring Tasks
**What:** Recurrence picker (daily/weekly/monthly/custom) in TaskDetail. When a recurring task is marked done, auto-create the next instance with the updated due date.
**Why:** Solves repetitive manual task re-entry for regular activities (weekly check-ins, monthly reviews, etc.)
**Pros:** Eliminates re-entry friction; keeps recurring commitments visible.
**Cons:** Auto-creation logic needs care — what happens if you complete a task early? What's the new due date?
**Context:** The `recurring` field already exists on the `Task` type. The store has `addTask`. Just needs UI + a completion hook in `updateTask` when status changes to 'done'.
**Effort:** M (human: ~3 hours / CC+gstack: ~15 min)
**Priority:** P2
**Depends on:** Data persistence (item 1 in CEO plan) — recurring tasks need to survive refresh to be useful.

---

## P3 — Task Labels
**What:** Wire the existing `label?: string` field on Task. Add a label input in TaskDetail, show as a small chip on task rows in TasksPage and Home, add label filter to TasksPage.
**Why:** Lets you quickly categorize tasks by type (phone call, email, research, waiting on...) without creating new projects.
**Pros:** Fast visual scanning; filterable; uses existing type field.
**Cons:** Another field in an already-busy TaskDetail layout.
**Context:** `Task.label` exists in `types/index.ts` but is never read or written anywhere in the UI.
**Effort:** S (human: ~45 min / CC+gstack: ~5 min)
**Priority:** P3
**Depends on:** Nothing.

---

## P3 — Calendar View in TasksPage
**What:** The `ViewType` type already has `'calendar'` as an option but it's not implemented in TasksPage. Would render tasks on a monthly/weekly calendar grid.
**Why:** Visual time-blocking; easy to see what's coming up across the month.
**Pros:** Complements the existing list/board views.
**Cons:** Calendar views are complex to build well (day/week/month modes, drag-to-reschedule, etc.)
**Context:** ViewType union type in `types/index.ts` includes 'calendar'. TasksPage view switcher only shows List/Board/MindMap.
**Effort:** L (human: ~1 day / CC+gstack: ~30 min)
**Priority:** P3
**Depends on:** Nothing, but nice to do after Google Calendar sync is solid.

---

## ✅ SHIPPED — Task Health Notification Sweep
**What:** On app load, scan all tasks and fire notifications for: tasks due tomorrow, tasks overdue, tasks flagged `within72Hours` that haven't been started (status === 'todo'). Also include: snooze date waking up today (`snoozeDate <= today`), wait date expired (`waitDate <= today` and status === 'waiting').
**Why:** Without this, the notification system only captures real-time collaboration events. Date-based signals (overdue, due tomorrow) require this sweep. It's the difference between "I got notified when Sarah changed something" vs "I know proactively what needs attention today."
**Pros:** High daily value; on-load sweep is clean (no polling needed); idempotent if we check for existing notifications before creating duplicates.
**Cons:** All 5 trigger types need deduplication logic (check if a notif of the same type + taskId already exists for today). Adds ~30ms to app load — acceptable.
**Context:** `Task.dueDate`, `Task.snoozeDate`, `Task.waitDate`, `Task.within72Hours`, `Task.status` all exist. `addNotification` exists in store. The `/api/send-notification` Pushover endpoint is now live (shipped with reminder feature) — the sweep can call it directly with no new infrastructure. The notification types to use: 'overdue', 'due_tomorrow', 'within72hrs', 'snooze_wake', 'wait_expired'. Dedup key: `type + taskId + date`. Pushover user key in `localStorage` as `pushover_user_key_{userId}`.
**Effort:** S (human: ~2hrs / CC+gstack: ~15 min) — **infrastructure cost is now $0, Pushover endpoint already exists**
**Priority:** P2
**Depends on:** Nothing blocking.

---

## P3 — Unit Tests for notification hooks + voice briefing
**What:** Spin up Vitest and write tests for: `useReminderChecker` (fire-window, skip-if-sent, skip-if-no-key), `useHealthSweep` (once-per-day dedup per task per type, morning briefing 5am–11am gate), and `triggerBriefing` in Home (local date correctness, overdue/today/urgent/sarah sentence building).
**Why:** Three hooks now contain timing-sensitive, date-sensitive logic with zero safety net. Changing the fire window, dedup key format, or date string format has no regression protection.
**Pros:** Vitest is zero-config with Vite. Documents intentional behavior (e.g., why editing time resets reminderSent, why UTC date was wrong). Catches date-boundary bugs before they surface.
**Cons:** Requires mocking `setInterval`, `fetch`, localStorage, and `window.speechSynthesis`. Adds test infrastructure to a personal tool.
**Context:** `FIRE_WINDOW_MS = 5 * 60 * 1000`. Dedup key format: `health_notif_{userId}_{type}_{taskId}_{YYYY-MM-DD}`. Morning briefing dedup: `briefing_sent_{userId}_{date}`. Voice briefing uses local date via `getFullYear/getMonth/getDate` (fixed from UTC `toISOString` bug in eng review 2026-03-21). Multi-user key lookup: `pushover_user_key_{userId}` in localStorage.
**Effort:** S (human: ~5hrs / CC+gstack: ~15 min)
**Priority:** P3
**Depends on:** Nothing.

---

## P3 — Voice Note Recording
**What:** Connect VoicePanel (currently a stub) to actual audio recording. Allow recording a voice note from TaskDetail or Home and attach it to a task.
**Why:** Zero-friction capture when typing is inconvenient.
**Pros:** The `audioNotes` array already exists on Task type. The UI skeleton (VoicePanel) is already there.
**Cons:** Requires MediaRecorder API, audio blob handling, storage (localStorage has size limits for blobs).
**Context:** `VoicePanel.tsx` exists but appears disconnected. `Task.audioNotes: AudioNote[]` exists in types.
**Effort:** L (human: ~2 days / CC+gstack: ~45 min)
**Priority:** P3
**Depends on:** Persistence, and likely needs a different storage strategy for audio blobs (IndexedDB vs localStorage).
