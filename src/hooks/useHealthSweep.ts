import { useEffect } from 'react';
import { useStore } from '../store';
import { getHealthNotifKey, getBriefingKey } from '../lib/storageKeys';

// Notification types fired by the health sweep
type SweepType = 'overdue' | 'due_tomorrow' | 'within72hrs' | 'snooze_wake' | 'wait_expired';

// Returns YYYY-MM-DD for a given Date (local timezone)
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Check if a notification has already been sent today for this task+type
function alreadySentToday(userId: string, type: SweepType, taskId: string): boolean {
  const today = localDateStr(new Date());
  return localStorage.getItem(getHealthNotifKey(userId, type, taskId, today)) === '1';
}

function markSentToday(userId: string, type: SweepType, taskId: string): void {
  const today = localDateStr(new Date());
  localStorage.setItem(getHealthNotifKey(userId, type, taskId, today), '1');
}

export function useHealthSweep(currentUserId: string) {
  const tasks = useStore((s) => s.tasks);
  const addNotification = useStore((s) => s.addNotification);

  useEffect(() => {
    const sweep = () => {
      const today = localDateStr(new Date());
      const todayMs = new Date(today).getTime();
      const tomorrowMs = todayMs + 86_400_000;
      const tomorrowStr = localDateStr(new Date(tomorrowMs));

      for (const task of tasks) {
        if (task.status === 'done') continue;

        const due = task.dueDate;
        const snooze = task.snoozeDate;
        const wait = task.waitDate;

        // --- OVERDUE ---
        if (due && due < today && !alreadySentToday(currentUserId, 'overdue', task.id)) {
          addNotification({ type: 'overdue', title: 'Overdue', body: task.title, taskId: task.id });
          markSentToday(currentUserId, 'overdue', task.id);
        }

        // --- DUE TOMORROW ---
        if (due === tomorrowStr && !alreadySentToday(currentUserId, 'due_tomorrow', task.id)) {
          addNotification({ type: 'due_tomorrow', title: 'Due tomorrow', body: task.title, taskId: task.id });
          markSentToday(currentUserId, 'due_tomorrow', task.id);
        }

        // --- WITHIN 72 HOURS ---
        if (
          task.flags?.some(f => f.flagId === 'flag-72h') &&
          task.status === 'todo' &&
          !alreadySentToday(currentUserId, 'within72hrs', task.id)
        ) {
          addNotification({ type: 'within72hrs', title: 'Needs attention soon', body: task.title, taskId: task.id });
          markSentToday(currentUserId, 'within72hrs', task.id);
        }

        // --- SNOOZE WAKE ---
        if (snooze && snooze <= today && !alreadySentToday(currentUserId, 'snooze_wake', task.id)) {
          addNotification({ type: 'snooze_wake', title: 'Snooze expired', body: task.title, taskId: task.id });
          markSentToday(currentUserId, 'snooze_wake', task.id);
        }

        // --- WAIT EXPIRED ---
        if (
          wait &&
          wait <= today &&
          task.status === 'waiting' &&
          !alreadySentToday(currentUserId, 'wait_expired', task.id)
        ) {
          addNotification({ type: 'wait_expired', title: 'Wait period over', body: task.title, taskId: task.id });
          markSentToday(currentUserId, 'wait_expired', task.id);
        }
      }

      // --- MORNING BRIEFING (in-app only) ---
      const briefingKey = getBriefingKey(currentUserId, today);
      const hour = new Date().getHours();
      if (hour >= 5 && hour < 11 && !localStorage.getItem(briefingKey)) {
        const overdueCount = tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < today).length;
        const dueTodayCount = tasks.filter(t => t.status !== 'done' && t.dueDate === today).length;
        const urgentCount = tasks.filter(t => t.status !== 'done' && (t.priority === 'urgent' || t.priority === 'high')).length;

        const lines: string[] = [];
        if (overdueCount > 0) lines.push(`${overdueCount} overdue`);
        if (dueTodayCount > 0) lines.push(`${dueTodayCount} due today`);
        if (urgentCount > 0) lines.push(`${urgentCount} urgent/high`);
        if (lines.length > 0) {
          addNotification({ type: 'overdue', title: 'Morning Briefing', body: lines.join(' · ') });
          localStorage.setItem(briefingKey, '1');
        }
      }
    };

    sweep();
    // Runs once on mount — intentionally no interval.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
