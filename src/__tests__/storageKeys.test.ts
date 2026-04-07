import { describe, it, expect } from 'vitest';
import {
  getReminderLockKey,
  getHealthNotifKey,
  getBriefingKey,
  GOOGLE_CLIENT_ID_KEY,
  GOOGLE_API_KEY_KEY,
  SIDEBAR_NAV_ORDER_KEY,
  SIDEBAR_PROJECT_ORDER_KEY,
} from '../lib/storageKeys';

describe('storageKeys', () => {
  describe('getReminderLockKey', () => {
    it('generates a key for a task id', () => {
      expect(getReminderLockKey('task-abc')).toBe('reminder_lock_task-abc');
    });

    it('keys are distinct for different tasks', () => {
      expect(getReminderLockKey('task-1')).not.toBe(getReminderLockKey('task-2'));
    });
  });

  describe('getHealthNotifKey', () => {
    it('combines all four dimensions into a unique key', () => {
      expect(getHealthNotifKey('lev', 'overdue', 'task-1', '2026-03-23')).toBe(
        'health_notif_lev_overdue_task-1_2026-03-23'
      );
    });

    it('differs when only the type changes', () => {
      const a = getHealthNotifKey('lev', 'overdue', 'task-1', '2026-03-23');
      const b = getHealthNotifKey('lev', 'due_tomorrow', 'task-1', '2026-03-23');
      expect(a).not.toBe(b);
    });

    it('differs when only the date changes', () => {
      const a = getHealthNotifKey('lev', 'overdue', 'task-1', '2026-03-23');
      const b = getHealthNotifKey('lev', 'overdue', 'task-1', '2026-03-24');
      expect(a).not.toBe(b);
    });
  });

  describe('getBriefingKey', () => {
    it('generates a key combining userId and date', () => {
      expect(getBriefingKey('lev', '2026-03-23')).toBe('briefing_sent_lev_2026-03-23');
    });

    it('differs by user', () => {
      expect(getBriefingKey('lev', '2026-03-23')).not.toBe(getBriefingKey('sarah', '2026-03-23'));
    });
  });

  describe('static keys', () => {
    it('GOOGLE_CLIENT_ID_KEY is a non-empty string', () => {
      expect(typeof GOOGLE_CLIENT_ID_KEY).toBe('string');
      expect(GOOGLE_CLIENT_ID_KEY.length).toBeGreaterThan(0);
    });

    it('GOOGLE_API_KEY_KEY is a non-empty string', () => {
      expect(typeof GOOGLE_API_KEY_KEY).toBe('string');
      expect(GOOGLE_API_KEY_KEY.length).toBeGreaterThan(0);
    });

    it('all static keys are distinct', () => {
      const keys = [
        GOOGLE_CLIENT_ID_KEY,
        GOOGLE_API_KEY_KEY,
        SIDEBAR_NAV_ORDER_KEY,
        SIDEBAR_PROJECT_ORDER_KEY,
      ];
      const unique = new Set(keys);
      expect(unique.size).toBe(keys.length);
    });
  });
});
