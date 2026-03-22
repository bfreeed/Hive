import { useEffect } from 'react';
import { useStore } from '../store';

const FIRE_WINDOW_MS = 5 * 60 * 1000; // 5-minute window to catch reminders if app was briefly closed

export function useReminderChecker(currentUserId: string) {
  const tasks = useStore((s) => s.tasks);
  const updateTask = useStore((s) => s.updateTask);

  useEffect(() => {
    const check = async () => {
      const now = Date.now();
      for (const task of tasks) {
        if (!task.reminderAt || task.reminderSent) continue;
        const t = new Date(task.reminderAt).getTime();
        if (t <= now && t > now - FIRE_WINDOW_MS) {
          const userKey = localStorage.getItem(`pushover_user_key_${currentUserId}`);
          if (!userKey) {
            console.warn(`[Reminder] Skipped "${task.title}" — no Pushover user key configured. Go to Settings → Reminders to set it.`);
            continue;
          }
          const taskLink = `${window.location.origin}/?task=${task.id}`;
          try {
            const resp = await fetch('/api/send-notification', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userKey,
                title: 'Task Reminder',
                message: task.title,
                url: taskLink,
                urlTitle: 'Open task',
              }),
            });
            if (resp.ok) {
              updateTask(task.id, { reminderSent: true });
            } else {
              const err = await resp.json().catch(() => ({}));
              console.error('Pushover notification failed:', err);
            }
          } catch (e) {
            console.error('Notification fetch error:', e);
          }
        }
      }
    };

    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [tasks, updateTask, currentUserId]);
}
