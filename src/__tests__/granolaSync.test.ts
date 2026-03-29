import { describe, it, expect } from 'vitest';
import {
  matchParticipantsToContacts,
  deduplicateNotes,
  normalizeToMeeting,
  type NormalizedNote,
} from '../hooks/useGranolaSync';
import type { Contact, Meeting } from '../types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeContact = (overrides: Partial<Contact> = {}): Contact => ({
  id: 'c1',
  name: 'Alice Example',
  email: 'alice@example.com',
  projectIds: [],
  meetings: [],
  linkedTaskIds: [],
  ...overrides,
});

const makeNote = (overrides: Partial<NormalizedNote> = {}): NormalizedNote => ({
  externalId: 'ext-1',
  provider: 'granola',
  title: 'Weekly Sync',
  date: '2026-03-27T10:00:00Z',
  notes: 'We talked about the project.',
  participantNames: ['Alice Example'],
  participantEmails: ['alice@example.com'],
  ...overrides,
});

const makeMeeting = (overrides: Partial<Meeting> = {}): Meeting => ({
  id: 'm1',
  contactId: '',
  title: 'Old meeting',
  date: '2026-03-26T09:00:00Z',
  notes: '',
  externalId: 'ext-1',
  provider: 'granola',
  createdAt: '2026-03-26T09:00:00Z',
  updatedAt: '2026-03-26T09:00:00Z',
  ...overrides,
});

// ---------------------------------------------------------------------------
// matchParticipantsToContacts
// ---------------------------------------------------------------------------

describe('matchParticipantsToContacts', () => {
  it('matches by exact email (case-insensitive)', () => {
    const contacts = [makeContact({ id: 'c1', email: 'alice@example.com' })];
    const result = matchParticipantsToContacts([], ['ALICE@EXAMPLE.COM'], contacts);
    expect(result).toEqual(['c1']);
  });

  it('matches by exact name (case-insensitive)', () => {
    const contacts = [makeContact({ id: 'c1', name: 'Alice Example', email: undefined })];
    const result = matchParticipantsToContacts(['alice example'], [], contacts);
    expect(result).toEqual(['c1']);
  });

  it('does not match partial names', () => {
    const contacts = [makeContact({ id: 'c1', name: 'Alice Example' })];
    const result = matchParticipantsToContacts(['Alice'], [], contacts);
    expect(result).toEqual([]);
  });

  it('returns unique IDs even if both name and email match', () => {
    const contacts = [makeContact({ id: 'c1', name: 'Alice Example', email: 'alice@example.com' })];
    const result = matchParticipantsToContacts(['Alice Example'], ['alice@example.com'], contacts);
    expect(result).toEqual(['c1']);
  });

  it('matches multiple contacts', () => {
    const contacts = [
      makeContact({ id: 'c1', name: 'Alice Example', email: 'alice@example.com' }),
      makeContact({ id: 'c2', name: 'Bob Smith', email: 'bob@example.com' }),
    ];
    const result = matchParticipantsToContacts(
      ['Alice Example', 'Bob Smith'],
      [],
      contacts
    );
    expect(result).toContain('c1');
    expect(result).toContain('c2');
    expect(result).toHaveLength(2);
  });

  it('returns empty array when no contacts match', () => {
    const contacts = [makeContact({ id: 'c1', name: 'Carol Jones', email: 'carol@example.com' })];
    const result = matchParticipantsToContacts(['Alice Example'], ['alice@example.com'], contacts);
    expect(result).toEqual([]);
  });

  it('handles contacts without email gracefully', () => {
    const contacts = [makeContact({ id: 'c1', name: 'Alice Example', email: undefined })];
    const result = matchParticipantsToContacts([], ['alice@example.com'], contacts);
    expect(result).toEqual([]); // no email on contact → no email match
  });

  it('returns empty array when both input arrays are empty', () => {
    const contacts = [makeContact()];
    const result = matchParticipantsToContacts([], [], contacts);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// deduplicateNotes
// ---------------------------------------------------------------------------

describe('deduplicateNotes', () => {
  it('filters out notes already in meetings by (provider, externalId)', () => {
    const existing = [makeMeeting({ externalId: 'ext-1', provider: 'granola' })];
    const notes = [makeNote({ externalId: 'ext-1', provider: 'granola' })];
    expect(deduplicateNotes(notes, existing)).toHaveLength(0);
  });

  it('keeps notes with a different externalId', () => {
    const existing = [makeMeeting({ externalId: 'ext-1', provider: 'granola' })];
    const notes = [makeNote({ externalId: 'ext-2', provider: 'granola' })];
    expect(deduplicateNotes(notes, existing)).toHaveLength(1);
  });

  it('keeps notes with same externalId but different provider', () => {
    const existing = [makeMeeting({ externalId: 'ext-1', provider: 'granola' })];
    const notes = [makeNote({ externalId: 'ext-1', provider: 'fireflies' })];
    expect(deduplicateNotes(notes, existing)).toHaveLength(1);
  });

  it('returns all notes when existing meetings is empty', () => {
    const notes = [makeNote({ externalId: 'ext-1' }), makeNote({ externalId: 'ext-2' })];
    expect(deduplicateNotes(notes, [])).toHaveLength(2);
  });

  it('ignores existing meetings without externalId (manual entries)', () => {
    const existing = [makeMeeting({ externalId: undefined, provider: undefined })];
    const notes = [makeNote({ externalId: 'ext-1' })];
    expect(deduplicateNotes(notes, existing)).toHaveLength(1);
  });

  it('handles mixed new and duplicate notes correctly', () => {
    const existing = [
      makeMeeting({ id: 'mx1', externalId: 'ext-1', provider: 'granola' }),
      makeMeeting({ id: 'mx2', externalId: 'ext-2', provider: 'granola' }),
    ];
    const notes = [
      makeNote({ externalId: 'ext-1' }),  // duplicate
      makeNote({ externalId: 'ext-3' }),  // new
    ];
    const result = deduplicateNotes(notes, existing);
    expect(result).toHaveLength(1);
    expect(result[0].externalId).toBe('ext-3');
  });
});

// ---------------------------------------------------------------------------
// normalizeToMeeting
// ---------------------------------------------------------------------------

describe('normalizeToMeeting', () => {
  it('maps provider fields correctly', () => {
    const note = makeNote({
      externalId: 'g-123',
      provider: 'granola',
      title: 'Q1 Planning',
      date: '2026-03-27T14:00:00Z',
      notes: 'Discussed roadmap.',
      transcript: 'Full transcript here.',
      summary: 'Summary of Q1.',
      participantNames: ['Alice'],
      participantEmails: ['alice@example.com'],
    });
    const result = normalizeToMeeting(note, ['c1']);
    expect(result.title).toBe('Q1 Planning');
    expect(result.provider).toBe('granola');
    expect(result.source).toBe('granola');
    expect(result.externalId).toBe('g-123');
    expect(result.transcript).toBe('Full transcript here.');
    expect(result.summary).toBe('Summary of Q1.');
    expect(result.participantNames).toEqual(['Alice']);
    expect(result.participantEmails).toEqual(['alice@example.com']);
  });

  it('sets reviewed to false for newly synced notes', () => {
    const note = makeNote();
    const result = normalizeToMeeting(note, []);
    expect(result.reviewed).toBe(false);
  });

  it('sets hasProjectLinks to false initially', () => {
    const note = makeNote();
    const result = normalizeToMeeting(note, []);
    expect(result.hasProjectLinks).toBe(false);
    expect(result.linkedProjectIds).toEqual([]);
    expect(result.suggestedProjectIds).toEqual([]);
    expect(result.actionItems).toEqual([]);
  });

  it('populates contactId from first matched contact', () => {
    const note = makeNote();
    const result = normalizeToMeeting(note, ['c1', 'c2']);
    expect(result.contactId).toBe('c1');
    expect(result.linkedContactIds).toEqual(['c1', 'c2']);
  });

  it('uses empty string contactId when no contacts matched', () => {
    const note = makeNote();
    const result = normalizeToMeeting(note, []);
    expect(result.contactId).toBe('');
    expect(result.linkedContactIds).toEqual([]);
  });

  it('maps source correctly for non-granola providers', () => {
    const note = makeNote({ provider: 'fireflies' });
    const result = normalizeToMeeting(note, []);
    expect(result.source).toBeUndefined();
    expect(result.provider).toBe('fireflies');
  });
});
