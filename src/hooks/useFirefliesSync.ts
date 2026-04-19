/**
 * useFirefliesSync — polls the Fireflies API every 15 minutes and upserts meetings
 * into the store. Mirrors the Granola sync pattern exactly.
 */

import { useEffect } from 'react';
import { useStore } from '../store';
import type { Meeting } from '../types';
import { apiFetch } from '../lib/apiFetch';
import {
  type NormalizedNote,
  matchParticipantsToContacts,
  normalizeToMeeting,
} from './useGranolaSync';

const POLL_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

export function useFirefliesSync() {
  const meetings = useStore(s => s.meetings);
  const contacts = useStore(s => s.contacts);
  const projects = useStore(s => s.projects);
  const userSettings = useStore(s => s.userSettings);
  const upsertMeeting = useStore(s => s.upsertMeeting);
  const updateMeeting = useStore(s => s.updateMeeting);
  const saveUserSettings = useStore(s => s.saveUserSettings);
  const firefliesManualSyncTrigger = useStore(s => s.firefliesManualSyncTrigger);

  useEffect(() => {
    const sync = async () => {
      const apiKey = userSettings?.firefliesApiKey;
      if (!apiKey) return;

      try {
        const syncRes = await apiFetch('/api/sync', {
          service: 'fireflies',
          since: userSettings?.firefliesLastSyncedAt ?? null,
          limit: 30,
        });

        if (!syncRes.ok) {
          const err = await syncRes.json().catch(() => ({})) as { error?: string };
          console.error('[useFirefliesSync] sync failed:', err.error);
          return;
        }

        const { notes } = await syncRes.json() as { notes: NormalizedNote[]; count: number };

        const existingIds = new Set(
          meetings.filter(m => m.provider && m.externalId).map(m => `${m.provider}:${m.externalId}`)
        );

        if (notes.length === 0) {
          await saveUserSettings({ firefliesLastSyncedAt: new Date().toISOString() });
          return;
        }

        const projectsForAI = projects.map(p => ({ id: p.id, name: p.name }));

        for (const note of notes) {
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

          const isNew = !existingIds.has(`${note.provider}:${note.externalId}`);
          const hasNoActionItems = !meeting.actionItems || meeting.actionItems.length === 0;
          if ((isNew || hasNoActionItems) && (note.notes || note.transcript)) {
            apiFetch('/api/link-meeting', {
              meetingId: meeting.id,
              title: note.title,
              notes: note.notes,
              transcript: note.transcript,
              projects: projectsForAI,
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
              .catch(e => console.error('[useFirefliesSync] link-meeting error:', e));
          }
        }

        await saveUserSettings({ firefliesLastSyncedAt: new Date().toISOString() });
      } catch (err) {
        console.error('[useFirefliesSync] unexpected error:', err);
      }
    };

    sync();
    const id = setInterval(sync, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [userSettings?.firefliesApiKey, firefliesManualSyncTrigger]); // eslint-disable-line react-hooks/exhaustive-deps
}
