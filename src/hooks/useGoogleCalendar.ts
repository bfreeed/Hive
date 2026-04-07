import type { Task } from '../types';

declare global {
  interface Window { google: any; }
}

// Shared token cache
let calToken: string | null = null;
let calTokenExpiry = 0;

function loadGSI(): Promise<void> {
  return new Promise((resolve) => {
    if (window.google?.accounts?.oauth2) { resolve(); return; }
    if (document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
      const wait = () => window.google?.accounts?.oauth2 ? resolve() : setTimeout(wait, 50);
      wait(); return;
    }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = () => resolve();
    document.head.appendChild(s);
  });
}

async function getToken(clientId: string, forcePrompt = false): Promise<string> {
  if (!forcePrompt && calToken && Date.now() < calTokenExpiry - 60000) return calToken;
  await loadGSI();
  return new Promise((res, rej) => {
    window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      // calendar.readonly lets us list calendars; calendar.events lets us create/update events
      scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly',
      callback: (r: any) => {
        if (r.error) { rej(r.error); return; }
        calToken = r.access_token;
        calTokenExpiry = Date.now() + (r.expires_in || 3600) * 1000;
        res(r.access_token);
      },
      error_callback: (e: any) => rej(e),
      ux_mode: 'popup',
    }).requestAccessToken({ prompt: forcePrompt ? 'consent' : '' });
  });
}

export interface CalendarEntry {
  id: string;
  summary: string;
  backgroundColor?: string;
  primary?: boolean;
  accessRole?: string;
}

export async function listCalendars(forcePrompt = false): Promise<CalendarEntry[]> {
  const clientId = localStorage.getItem('google_client_id')?.trim();
  if (!clientId) return [];
  const token = await getToken(clientId, forcePrompt);
  const res = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer',
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items ?? []) as CalendarEntry[];
}

export async function syncTaskToCalendar(task: Task, forcePrompt = false): Promise<string | null> {
  const clientId = localStorage.getItem('google_client_id')?.trim();
  if (!clientId || !task.dueDate) return null;

  const token = await getToken(clientId, forcePrompt);
  const calId = task.calendarId || 'primary';
  const showAs = task.calendarShowAs || 'free';
  const dateStr = task.dueDate.slice(0, 10);

  const event: any = {
    summary: task.title,
    description: task.description || '',
    transparency: showAs === 'free' ? 'transparent' : 'opaque',
    ...(task.reminderMinutes != null ? {
      reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: task.reminderMinutes }] }
    } : { reminders: { useDefault: true } }),
  };

  if (!task.dueTime) {
    event.start = { date: dateStr };
    event.end = { date: dateStr };
  } else {
    const start = new Date(`${dateStr}T${task.dueTime}`);
    const end = task.dueTimeEnd
      ? new Date(`${dateStr}T${task.dueTimeEnd}`)
      : new Date(start.getTime() + 60 * 60 * 1000);
    event.start = { dateTime: start.toISOString() };
    event.end = { dateTime: end.toISOString() };
  }

  const method = task.calendarEventId ? 'PUT' : 'POST';
  const url = task.calendarEventId
    ? `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${task.calendarEventId}`
    : `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`;

  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  const data = await res.json();
  return data.id || null;
}

export async function deleteCalendarEvent(eventId: string, calendarId?: string): Promise<void> {
  const clientId = localStorage.getItem('google_client_id')?.trim();
  if (!clientId || !eventId) return;
  const token = await getToken(clientId);
  const calId = calendarId || 'primary';
  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${eventId}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
  );
}

export function hasCalendarToken(): boolean {
  return !!(calToken && Date.now() < calTokenExpiry - 60000);
}
