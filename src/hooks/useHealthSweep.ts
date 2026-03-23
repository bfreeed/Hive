import { useEffect } from 'react';
import { useStore } from '../store';

// Notification types fired by the health sweep
type SweepType = 'overdue' | 'due_tomorrow' | 'within72hrs' | 'snooze_wake' | 'wait_expired';

// Returns YYYY-MM-DD for a given Date (local timezone)
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Check if a notification has already been sent today for this task+type
function alreadySentToday(userId: string, type: SweepType, taskId: string): boolean {
  const today = localDateStr(new Date());
  return localStorage.getItem(`health_notif_${userId}_${type}_${taskId}_${today}`) === '1';
}

function markSentToday(userId: string, type: SweepType, taskId: string): void {
  const today = localDateStr(new Date());
  localStorage.setItem(`health_notif_${userId}_${type}_${taskId}_${today}`, '1');
}

async function sendPush(
  userKey: string,
  title: string,
  message: string,
  taskId?: string
): Promise<boolean> {
  try {
    const body: Record<string, string> = { userKey, title, message };
    if (taskId) {
      body.url = `${window.location.origin}/?task=${taskId}`;
      body.urlTitle = 'Open task';
    }
    const resp = await fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export function useHealthSweep(currentUserId: string) {
  const tasks = useStore((s) => s.tasks);
  const addNotification = useStore((s) => s.addNotification);

  useEffect(() => {
    const sweep = async () => {
      const userKey = localStorage.getItem(`pushover_user_key_${currentUserId}`);
      const today = localDateStr(new Date());
      const todayMs = new Date(today).getTime();
      const tomorrowMs = todayMs + 86_400_000;
      const tomorrowStr = localDateStr(new Date(tomorrowMs));

      // Collect tasks for the morning briefing (due today or overdue, not done)
      const briefingTasks: string[] = [];

      for (const task of tasks) {
        if (task.status === 'done') continue;

        const due = task.dueDate;
        const snooze = task.snoozeDate;
        const wait = task.waitDate;

        // --- OVERDUE ---
        if (due && due < today && !alreadySentToday(currentUserId, 'overdue', task.id)) {
          briefingTasks.push(task.title);
          if (userKey) {
            const ok = await sendPush(userKey, '⚠️ Overdue', task.title, task.id);
            if (ok) {
              markSentToday(currentUserId, 'overdue', task.id);
              addNotification({ type: 'overdue', title: 'Overdue', body: task.title, taskId: task.id });
            } else {
              console.warn(`[HealthSweep] Pushover failed for overdue: "${task.title}"`);
            }
          } else {
            addNotification({ type: 'overdue', title: 'Overdue', body: task.title, taskId: task.id });
            markSentToday(currentUserId, 'overdue', task.id);
          }
        }

        // --- DUE TOMORROW ---
        if (due === tomorrowStr && !alreadySentToday(currentUserId, 'due_tomorrow', task.id)) {
          if (userKey) {
            const ok = await sendPush(userKey, '📅 Due tomorrow', task.title, task.id);
            if (ok) {
              markSentToday(currentUserId, 'due_tomorrow', task.id);
              addNotification({ type: 'due_tomorrow', title: 'Due tomorrow', body: task.title, taskId: task.id });
            } else {
              console.warn(`[HealthSweep] Pushover failed for due_tomorrow: "${task.title}"`);
            }
          } else {
            addNotification({ type: 'due_tomorrow', title: 'Due tomorrow', body: task.title, taskId: task.id });
            markSentToday(currentUserId, 'due_tomorrow', task.id);
          }
        }

        // --- DUE TODAY (collect for briefing, no individual push) ---
        if (due === today) {
          briefingTasks.push(task.title);
        }

        // --- WITHIN 72 HOURS ---
        if (
          task.flags?.some(f => f.flagId === 'flag-72h') &&
          task.status === 'todo' &&
          !alreadySentToday(currentUserId, 'within72hrs', task.id)
        ) {
          if (userKey) {
            const ok = await sendPush(userKey, '⏰ Needs attention soon', task.title, task.id);
            if (ok) {
              markSentToday(currentUserId, 'within72hrs', task.id);
              addNotification({ type: 'within72hrs', title: 'Needs attention soon', body: task.title, taskId: task.id });
            } else {
              console.warn(`[HealthSweep] Pushover failed for within72hrs: "${task.title}"`);
            }
          } else {
            addNotification({ type: 'within72hrs', title: 'Needs attention soon', body: task.title, taskId: task.id });
            markSentToday(currentUserId, 'within72hrs', task.id);
          }
        }

        // --- SNOOZE WAKE ---
        if (snooze && snooze <= today && !alreadySentToday(currentUserId, 'snooze_wake', task.id)) {
          if (userKey) {
            const ok = await sendPush(userKey, '🔔 Snooze expired', task.title, task.id);
            if (ok) {
              markSentToday(currentUserId, 'snooze_wake', task.id);
              addNotification({ type: 'snooze_wake', title: 'Snooze expired', body: task.title, taskId: task.id });
            } else {
              console.warn(`[HealthSweep] Pushover failed for snooze_wake: "${task.title}"`);
            }
          } else {
            addNotification({ type: 'snooze_wake', title: 'Snooze expired', body: task.title, taskId: task.id });
            markSentToday(currentUserId, 'snooze_wake', task.id);
          }
        }

        // --- WAIT EXPIRED ---
        if (
          wait &&
          wait <= today &&
          task.status === 'waiting' &&
          !alreadySentToday(currentUserId, 'wait_expired', task.id)
        ) {
          if (userKey) {
            const ok = await sendPush(userKey, '✅ Wait period over', task.title, task.id);
            if (ok) {
              markSentToday(currentUserId, 'wait_expired', task.id);
              addNotification({ type: 'wait_expired', title: 'Wait period over', body: task.title, taskId: task.id });
            } else {
              console.warn(`[HealthSweep] Pushover failed for wait_expired: "${task.title}"`);
            }
          } else {
            addNotification({ type: 'wait_expired', title: 'Wait period over', body: task.title, taskId: task.id });
            markSentToday(currentUserId, 'wait_expired', task.id);
          }
        }
      }

      // --- MORNING BRIEFING ---
      // Fire once per day between 5am–11am if Pushover key is set
      if (userKey) {
        const briefingKey = `briefing_sent_${currentUserId}_${today}`;
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 11 && !localStorage.getItem(briefingKey)) {
          const urgentCount = tasks.filter(
            (t) => t.status !== 'done' && (t.priority === 'urgent' || t.priority === 'high')
          ).length;
          const overdueCount = tasks.filter(
            (t) => t.status !== 'done' && t.dueDate && t.dueDate < today
          ).length;
          const dueTodayCount = tasks.filter(
            (t) => t.status !== 'done' && t.dueDate === today
          ).length;

          const lines: string[] = [];
          if (overdueCount > 0) lines.push(`⚠️ ${overdueCount} overdue`);
          if (dueTodayCount > 0) lines.push(`📅 ${dueTodayCount} due today`);
          if (urgentCount > 0) lines.push(`🔴 ${urgentCount} urgent/high`);
          if (lines.length === 0) lines.push('All clear — no urgent items today.');

          const ok = await sendPush(
            userKey,
            '☀️ Morning Briefing',
            lines.join(' · ')
          );
          if (ok) {
            localStorage.setItem(briefingKey, '1');
            console.log('[HealthSweep] Morning briefing sent:', lines.join(' · '));
          } else {
            console.warn('[HealthSweep] Morning briefing Pushover failed');
          }
        }
      }
    };

    sweep();
    // Runs once on mount — intentionally no interval. Re-runs on next app open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // empty deps: run once on mount, not on every task change
}
