import { useEffect } from 'react';
import { useStore } from '../store';

const FIRE_WINDOW_MS = 5 * 60 * 1000; // 5-minute window to catch reminders if app was briefly closed
const TAB_LOCK_TTL_MS = 15_000;        // Multi-tab dedup: lock expires after 15s

async function sendReminder(userKey: string, title: string, message: string, url: string): Promise<boolean> {
  try {
    const resp = await fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userKey, title, message, url, urlTitle: 'Open task' }),
    });
    if (resp.ok) return true;
    const err = await resp.json().catch(() => ({}));
    console.error('Pushover notification failed:', err);
    return false;
  } catch (e) {
    console.error('Notification fetch error:', e);
    return false;
  }
}

export function useReminderChecker(currentUserId: string) {
  const tasks = useStore((s) => s.tasks);
  const updateTask = useStore((s) => s.updateTask);

  useEffect(() => {
    const check = async () => {
      const now = Date.now();
      for (const task of tasks) {
        if (!task.reminderAt || task.reminderSent) continue;
        const t = new Date(task.reminderAt).getTime();
        if (!(t <= now && t > now - FIRE_WINDOW_MS)) continue;

        // Multi-tab dedup: only one tab fires per task reminder
        const lockKey = `reminder_lock_${task.id}`;
        const lockVal = localStorage.getItem(lockKey);
        if (lockVal && now - Number(lockVal) < TAB_LOCK_TTL_MS) continue;
        localStorage.setItem(lockKey, String(now));

        // Notify all assignees (or current user if task is unassigned)
        const recipientIds = task.assigneeIds.length > 0 ? task.assigneeIds : [currentUserId];
        const taskLink = `${window.location.origin}/?task=${task.id}`;

        let anySent = false;
        for (const userId of recipientIds) {
          const userKey = localStorage.getItem(`pushover_user_key_${userId}`);
          if (!userKey) {
            if (userId === currentUserId) {
              console.warn(`[Reminder] Skipped "${task.title}" — no Pushover key for ${userId}. Go to Settings → Reminders.`);
            }
            continue;
          }
          const ok = await sendReminder(userKey, 'Task Reminder', task.title, taskLink);
          if (ok) anySent = true;
        }

        if (anySent) updateTask(task.id, { reminderSent: true });
        localStorage.removeItem(lockKey);
      }
    };

    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [tasks, updateTask, currentUserId]);
}
