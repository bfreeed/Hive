import { describe, it, expect } from 'vitest';
import { buildTaskPayload } from '../components/QuickCapture';

const base = {
  title: 'Call Sarah',
  dueDate: '2026-03-27',
  dueTime: '16:00',
  reminderAt: '2026-03-27T15:30',
  priority: 'high',
  assigneeIds: ['sarah-id'],
  projectIds: ['roof-project'],
};

describe('buildTaskPayload', () => {
  it('maps all fields from parsed form state', () => {
    const payload = buildTaskPayload(base);
    expect(payload.title).toBe('Call Sarah');
    expect(payload.dueDate).toBe('2026-03-27');
    expect(payload.dueTime).toBe('16:00');
    expect(payload.priority).toBe('high');
    expect(payload.assigneeIds).toEqual(['sarah-id']);
    expect(payload.projectIds).toEqual(['roof-project']);
    expect(payload.status).toBe('todo');
    expect(payload.reminderSent).toBe(false);
    expect(payload.isPrivate).toBe(false);
  });

  it('converts reminderAt to a full ISO string', () => {
    const payload = buildTaskPayload(base);
    // Should be a valid ISO 8601 date string
    expect(() => new Date(payload.reminderAt!)).not.toThrow();
    expect(payload.reminderAt).toContain('2026-03-27');
  });

  it('sets reminderAt to undefined when empty', () => {
    const payload = buildTaskPayload({ ...base, reminderAt: '' });
    expect(payload.reminderAt).toBeUndefined();
  });

  it('sets dueDate to undefined when empty', () => {
    const payload = buildTaskPayload({ ...base, dueDate: '' });
    expect(payload.dueDate).toBeUndefined();
  });

  it('sets dueTime to undefined when empty', () => {
    const payload = buildTaskPayload({ ...base, dueTime: '' });
    expect(payload.dueTime).toBeUndefined();
  });

  it('defaults priority to medium when empty', () => {
    const payload = buildTaskPayload({ ...base, priority: '' });
    expect(payload.priority).toBe('medium');
  });

  it('initialises arrays as empty when no assignees or projects', () => {
    const payload = buildTaskPayload({ ...base, assigneeIds: [], projectIds: [] });
    expect(payload.assigneeIds).toEqual([]);
    expect(payload.projectIds).toEqual([]);
    expect(payload.flags).toEqual([]);
    expect(payload.linkedContactIds).toEqual([]);
    expect(payload.linkedDocIds).toEqual([]);
  });
});
