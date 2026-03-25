import { describe, it, expect } from 'vitest';
import {
  isInFireWindow,
  getRecipientIds,
  FIRE_WINDOW_MS,
  TAB_LOCK_TTL_MS,
} from '../hooks/useReminderChecker';

describe('isInFireWindow', () => {
  const NOW = 1_700_000_000_000; // fixed reference timestamp

  it('returns true when reminderAt is exactly now', () => {
    const reminderAt = new Date(NOW).toISOString();
    expect(isInFireWindow(reminderAt, NOW)).toBe(true);
  });

  it('returns true when reminderAt is 1ms before now', () => {
    const reminderAt = new Date(NOW - 1).toISOString();
    expect(isInFireWindow(reminderAt, NOW)).toBe(true);
  });

  it('returns true when reminderAt is at the edge of the fire window (FIRE_WINDOW_MS - 1ms)', () => {
    const reminderAt = new Date(NOW - FIRE_WINDOW_MS + 1).toISOString();
    expect(isInFireWindow(reminderAt, NOW)).toBe(true);
  });

  it('returns false when reminderAt equals now - FIRE_WINDOW_MS (boundary — exclusive)', () => {
    const reminderAt = new Date(NOW - FIRE_WINDOW_MS).toISOString();
    expect(isInFireWindow(reminderAt, NOW)).toBe(false);
  });

  it('returns false when reminderAt is older than the fire window', () => {
    const reminderAt = new Date(NOW - FIRE_WINDOW_MS - 1).toISOString();
    expect(isInFireWindow(reminderAt, NOW)).toBe(false);
  });

  it('returns false when reminderAt is in the future', () => {
    const reminderAt = new Date(NOW + 1).toISOString();
    expect(isInFireWindow(reminderAt, NOW)).toBe(false);
  });

  it('returns false when reminderAt is far in the future', () => {
    const reminderAt = new Date(NOW + 60 * 60 * 1000).toISOString();
    expect(isInFireWindow(reminderAt, NOW)).toBe(false);
  });

  it('respects a custom windowMs override', () => {
    const shortWindow = 10_000; // 10s
    const justInside = new Date(NOW - shortWindow + 1).toISOString();
    const justOutside = new Date(NOW - shortWindow).toISOString();
    expect(isInFireWindow(justInside, NOW, shortWindow)).toBe(true);
    expect(isInFireWindow(justOutside, NOW, shortWindow)).toBe(false);
  });
});

describe('getRecipientIds', () => {
  it('returns the assignees when the task has assignees', () => {
    expect(getRecipientIds(['alice', 'bob'], 'lev')).toEqual(['alice', 'bob']);
  });

  it('returns [currentUserId] when the task has no assignees', () => {
    expect(getRecipientIds([], 'lev')).toEqual(['lev']);
  });

  it('returns a single assignee (not falling through to currentUser)', () => {
    expect(getRecipientIds(['sarah'], 'lev')).toEqual(['sarah']);
  });

  it('returns currentUser alone when assigneeIds is empty — does not merge', () => {
    const result = getRecipientIds([], 'lev');
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('lev');
  });
});

describe('constants', () => {
  it('FIRE_WINDOW_MS is 5 minutes', () => {
    expect(FIRE_WINDOW_MS).toBe(5 * 60 * 1000);
  });

  it('TAB_LOCK_TTL_MS equals FIRE_WINDOW_MS — lock held for the full fire window to prevent duplicate sends', () => {
    expect(TAB_LOCK_TTL_MS).toBe(FIRE_WINDOW_MS);
  });
});
