/**
 * useGranolaSync — polls the Granola API every 15 minutes and upserts meetings
 * into the store. Pure functions are exported separately for unit testing.
 *
 * Architecture:
 *   Browser → /api/sync-granola (Vite middleware, reads env.GRANOLA_API_KEY)
 *           → Granola API → NormalizedNote[]
 *           → deduplicateNotes() → upsertMeeting() per new note
 *           → /api/link-meeting (Vite middleware, calls Claude)
 *           → updateMeeting() with linkedProjectIds, suggestedProjectIds, actionItems
 */

import { useEffect } from 'react';
import { useStore } from '../store';
import type { Meeting, Contact } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NormalizedNote {
  externalId: string;
  provider: 'granola' | 'fireflies' | 'otter' | 'native' | 'manual';
  title: string;
  date: string;
  notes: string;
  transcript?: string;
  summary?: string;
  participantNames?: string[];
  participantEmails?: string[];
}

// ---------------------------------------------------------------------------
// Pure functions (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Find contacts whose name or email matches any meeting participant.
 * Returns contact IDs that are "strong" matches (email match or full name match).
 */
export function matchParticipantsToContacts(
  participantNames: string[],
  participantEmails: string[],
  contacts: Contact[]
): string[] {
  const matched = new Set<string>();
  for (const contact of contacts) {
    const emailMatch = contact.email && participantEmails.some(
      e => e.toLowerCase() === contact.email!.toLowerCase()
    );
    const nameMatch = participantNames.some(
      n => n.toLowerCase() === contact.name.toLowerCase()
    );
    if (emailMatch || nameMatch) matched.add(contact.id);
  }
  return Array.from(matched);
}

/**
 * Filter out notes already present in existing meetings by (provider, externalId).
 */
export function deduplicateNotes(
  notes: NormalizedNote[],
  existingMeetings: Meeting[]
): NormalizedNote[] {
  const seen = new Set(
    existingMeetings
      .filter(m => m.externalId && m.provider)
      .map(m => `${m.provider}:${m.externalId}`)
  );
  return notes.filter(n => !seen.has(`${n.provider}:${n.externalId}`));
}

/**
 * Normalise a raw note to a Meeting (without id/timestamps, those are added by store).
 */
export function normalizeToMeeting(
  note: NormalizedNote,
  matchedContactIds: string[]
): Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    contactId: matchedContactIds[0] ?? '',  // primary contact for backward-compat
    title: note.title,
    date: note.date,
    notes: note.notes,
    source: note.provider === 'granola' ? 'granola' : undefined,
    externalId: note.externalId,
    provider: note.provider,
    transcript: note.transcript,
    summary: note.summary,
    participantNames: note.participantNames ?? [],
    participantEmails: note.participantEmails ?? [],
    linkedContactIds: matchedContactIds,
    linkedProjectIds: [],
    suggestedProjectIds: [],
    actionItems: [],
    hasProjectLinks: false,
    reviewed: false,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export function useGranolaSync() {
  const meetings = useStore(s => s.meetings);
  const contacts = useStore(s => s.contacts);
  const projects = useStore(s => s.projects);
  const userSettings = useStore(s => s.userSettings);
  const upsertMeeting = useStore(s => s.upsertMeeting);
  const updateMeeting = useStore(s => s.updateMeeting);
  const saveUserSettings = useStore(s => s.saveUserSettings);

  useEffect(() => {
    const sync = async () => {
      const apiKey = userSettings?.granolaApiKey;
      if (!apiKey) return; // no key configured yet

      try {
        // --- 1. Fetch from Granola ---
        const syncRes = await fetch('/api/sync-granola', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey,
            since: userSettings?.granolaLastSyncedAt ?? null,
            limit: 30,
          }),
        });

        if (!syncRes.ok) {
          const err = await syncRes.json().catch(() => ({})) as { error?: string };
          console.error('[useGranolaSync] sync failed:', err.error);
          return;
        }

        const { notes } = await syncRes.json() as { notes: NormalizedNote[]; count: number };

        // --- 2. Deduplicate ---
        const newNotes = deduplicateNotes(notes, meetings);
        if (newNotes.length === 0) {
          // Still update the last-synced timestamp
          await saveUserSettings({ granolaLastSyncedAt: new Date().toISOString() });
          return;
        }

        // --- 3. Match contacts & upsert each new note ---
        const projectsForAI = projects.map(p => ({ id: p.id, name: p.name }));

        for (const note of newNotes) {
          const matchedContactIds = matchParticipantsToContacts(
            note.participantNames ?? [],
            note.participantEmails ?? [],
            contacts
          );

          const meeting = await upsertMeeting({
            ...normalizeToMeeting(note, matchedContactIds),
            externalId: note.externalId,
            provider: note.provider,
          });

          // --- 4. AI linking (fire-and-forget, don't block sync) ---
          if (note.notes || note.transcript) {
            fetch('/api/link-meeting', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                meetingId: meeting.id,
                title: note.title,
                notes: note.notes,
                transcript: note.transcript,
                projects: projectsForAI,
              }),
            })
              .then(r => r.json())
              .then((linked: { linkedProjectIds?: string[]; suggestedProjectIds?: string[]; actionItems?: Meeting['actionItems'] }) => {
                updateMeeting(meeting.id, {
                  linkedProjectIds: linked.linkedProjectIds ?? [],
                  suggestedProjectIds: linked.suggestedProjectIds ?? [],
                  actionItems: linked.actionItems ?? [],
                  hasProjectLinks: (linked.linkedProjectIds?.length ?? 0) > 0,
                });
              })
              .catch(e => console.error('[useGranolaSync] link-meeting error:', e));
          }
        }

        // --- 5. Update last-synced timestamp ---
        await saveUserSettings({ granolaLastSyncedAt: new Date().toISOString() });
      } catch (err) {
        console.error('[useGranolaSync] unexpected error:', err);
      }
    };

    // Run immediately on mount, then on interval
    sync();
    const id = setInterval(sync, POLL_INTERVAL_MS);
    return () => clearInterval(id);

    // Re-run if the API key changes (user just configured it)
  }, [userSettings?.granolaApiKey]); // eslint-disable-line react-hooks/exhaustive-deps
}
