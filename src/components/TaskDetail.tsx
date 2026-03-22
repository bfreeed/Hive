import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../store';
import { X, Trash2, Paperclip, FileText, Lock, Cloud, Calendar, Check, RefreshCw, Clock, BellOff, Bell } from 'lucide-react';
import type { Task, TaskStatus, Priority } from '../types';
import { format } from 'date-fns';
import { useGooglePicker } from '../hooks/useGooglePicker';
import { syncTaskToCalendar, deleteCalendarEvent, hasCalendarToken } from '../hooks/useGoogleCalendar';

const STATUS_OPTIONS: { value: TaskStatus; label: string; active: string }[] = [
  { value: 'todo',    label: 'To Do',     active: 'bg-white/10 text-white/70 ring-1 ring-white/20' },
  { value: 'doing',   label: 'Doing',     active: 'bg-brand-500/20 text-brand-400 ring-1 ring-brand-500/30' },
  { value: 'waiting', label: 'Waiting',   active: 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/30' },
  { value: 'review',  label: 'In Review', active: 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500/30' },
  { value: 'done',    label: 'Done',      active: 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30' },
];

const PRIORITY_OPTIONS: { value: Priority; label: string; dot: string; active: string }[] = [
  { value: 'urgent', label: 'Urgent', dot: 'bg-red-400',    active: 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30' },
  { value: 'high',   label: 'High',   dot: 'bg-orange-400', active: 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30' },
  { value: 'medium', label: 'Medium', dot: 'bg-yellow-400', active: 'bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30' },
  { value: 'low',    label: 'Low',    dot: 'bg-white/20',   active: 'bg-white/10 text-white/50 ring-1 ring-white/20' },
];

export default function TaskDetail({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { tasks, projects, users, currentUser, updateTask, deleteTask, addComment } = useStore();
  const task = tasks.find(t => t.id === taskId);
  const [commentText, setCommentText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [calSyncing, setCalSyncing] = useState(false);
  const [calSynced, setCalSynced] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevDueDateRef = useRef<string | undefined>(undefined);

  const { open: openDrivePicker, loading: driveLoading } = useGooglePicker((file) => {
    const att = {
      id: Math.random().toString(36).slice(2, 9),
      name: file.name,
      type: file.mimeType,
      url: file.url,
      source: 'google_drive' as const,
      driveId: file.id,
      createdAt: new Date().toISOString(),
    };
    updateTask(taskId, { attachments: [...(task!.attachments || []), att] });
  });

  const doSync = useCallback(async (forcePrompt = false) => {
    if (!task || !task.calendarSync) return;
    const clientId = localStorage.getItem('google_client_id')?.trim();
    if (!clientId) return;
    setCalSyncing(true);
    setNeedsAuth(false);
    try {
      const eventId = await syncTaskToCalendar(task, forcePrompt);
      if (eventId) updateTask(taskId, { calendarEventId: eventId });
      setCalSynced(true);
      setTimeout(() => setCalSynced(false), 3000);
    } catch (e: any) {
      if (e?.type === 'popup_blocked' || e === 'popup_closed_by_user' || e?.error === 'interaction_required') {
        setNeedsAuth(true);
      } else {
        console.error('Calendar sync failed:', e);
      }
    } finally {
      setCalSyncing(false);
    }
  }, [task, taskId, updateTask]);

  // Auto-sync when dueDate changes (if calendarSync is on and token is cached)
  useEffect(() => {
    if (!task) return;
    const prev = prevDueDateRef.current;
    const curr = task.dueDate;
    prevDueDateRef.current = curr;

    if (prev === undefined) return; // skip initial mount

    if (!curr && task.calendarEventId) {
      // Due date removed — delete calendar event
      deleteCalendarEvent(task.calendarEventId).then(() => {
        updateTask(taskId, { calendarEventId: undefined });
      });
      return;
    }

    if (curr && task.calendarSync) {
      if (hasCalendarToken()) {
        doSync(false);
      } else {
        setNeedsAuth(true); // prompt user to authorize once
      }
    }
  }, [task?.dueDate]);

  if (!task) return null;
  const taskProjects = projects.filter(p => task.projectIds?.includes(p.id));
  const project = taskProjects[0];

  const update = (field: keyof Task, value: any) => updateTask(taskId, { [field]: value });

  const handleAddComment = () => {
    if (!commentText.trim()) return;
    addComment(taskId, commentText.trim());
    setCommentText('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const att = { id: Math.random().toString(36).slice(2,9), name: file.name, type: file.type, url: ev.target?.result as string, createdAt: new Date().toISOString() };
        updateTask(taskId, { attachments: [...(task.attachments || []), att] });
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Slide-over panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-[600px] bg-[#111113] border-l border-white/[0.08] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex items-center gap-2">
            {taskProjects.map(p => (
              <span key={p.id} className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: p.color + '22', color: p.color }}>
                {p.name}
              </span>
            ))}
            {task.isPrivate && <span className="flex items-center gap-1 text-xs text-white/30"><Lock size={10} /> Private</span>}
          </div>
          <div className="flex items-center gap-1">
            {confirmDelete ? (
              <>
                <span className="text-xs text-white/40 mr-2">Delete this task?</span>
                <button onClick={() => { deleteTask(taskId); onClose(); }} className="px-3 py-1.5 bg-red-500/20 text-red-400 text-xs rounded-lg hover:bg-red-500/30 transition-colors">Yes, delete</button>
                <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 text-white/30 text-xs rounded-lg hover:text-white/60 transition-colors">Cancel</button>
              </>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="p-1.5 rounded-md text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                <Trash2 size={14} />
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-md text-white/30 hover:text-white hover:bg-white/[0.06] transition-colors ml-1">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="px-6 py-5 space-y-6">

            {/* Title */}
            <textarea
              className="w-full bg-transparent text-xl font-semibold text-white resize-none focus:outline-none placeholder-white/20 leading-snug"
              value={task.title}
              onChange={(e) => update('title', e.target.value)}
              rows={task.title.length > 55 ? 2 : 1}
              placeholder="Task title..."
            />

            {/* Status */}
            <div>
              <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Status</p>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_OPTIONS.map(s => (
                  <button
                    key={s.value}
                    onClick={() => update('status', s.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${task.status === s.value ? s.active : 'text-white/30 hover:text-white/60 bg-white/[0.04] hover:bg-white/[0.06]'}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div>
              <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Priority</p>
              <div className="flex flex-wrap gap-1.5">
                {PRIORITY_OPTIONS.map(p => (
                  <button
                    key={p.value}
                    onClick={() => update('priority', p.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${task.priority === p.value ? p.active : 'text-white/30 hover:text-white/60 bg-white/[0.04] hover:bg-white/[0.06]'}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.dot}`} />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Assignee + Due Date */}
            <div className="grid grid-cols-2 gap-5">
              <div>
                <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Assignee</p>
                <div className="flex flex-wrap gap-1.5">
                  {users.map(u => {
                    const assigned = task.assigneeIds.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        onClick={() => update('assigneeIds', assigned ? task.assigneeIds.filter(id => id !== u.id) : [...task.assigneeIds, u.id])}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${assigned ? 'bg-brand-600/25 text-brand-300 ring-1 ring-brand-500/30' : 'bg-white/[0.04] text-white/35 hover:text-white/70 hover:bg-white/[0.07]'}`}
                      >
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${assigned ? 'bg-brand-600' : 'bg-white/15'}`}>
                          {u.name[0]}
                        </div>
                        {u.name.split(' ')[0]}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-white/30 uppercase tracking-wider">Due Date & Time</p>
                <input
                  type="date"
                  value={task.dueDate ? task.dueDate.slice(0, 10) : ''}
                  onChange={(e) => update('dueDate', e.target.value ? new Date(e.target.value + 'T12:00:00').toISOString() : undefined)}
                  className="px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white/60 focus:outline-none focus:border-brand-500/40 w-full"
                  style={{ colorScheme: 'dark' }}
                />
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-white/25 w-8 flex-shrink-0">Start</span>
                    <input
                      type="time"
                      value={task.dueTime || ''}
                      onChange={(e) => update('dueTime', e.target.value || undefined)}
                      className="px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white/60 focus:outline-none focus:border-brand-500/40 flex-1"
                      style={{ colorScheme: 'dark' }}
                    />
                    {task.dueTime && (
                      <button
                        onClick={() => { update('dueTime', undefined); update('dueTimeEnd', undefined); }}
                        className="px-2 py-1.5 rounded-lg text-xs text-white/30 hover:text-white/70 bg-white/[0.04] hover:bg-white/[0.08] transition-colors whitespace-nowrap"
                      >
                        All day
                      </button>
                    )}
                  </div>
                  {task.dueTime && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-white/25 w-8 flex-shrink-0">End</span>
                      <input
                        type="time"
                        value={task.dueTimeEnd || ''}
                        onChange={(e) => update('dueTimeEnd', e.target.value || undefined)}
                        className="px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-sm text-white/60 focus:outline-none focus:border-brand-500/40 flex-1"
                        style={{ colorScheme: 'dark' }}
                        placeholder="optional"
                      />
                      <div className="px-2 py-1.5 text-xs invisible whitespace-nowrap">All day</div>
                    </div>
                  )}
                  {!task.dueTime && (
                    <p className="text-xs text-white/20 px-1">All day event</p>
                  )}
                </div>
                {/* Calendar sync controls */}
                <div className="flex items-center gap-2 pt-0.5">
                  <button
                    onClick={() => update('calendarShowAs', task.calendarShowAs === 'free' ? 'busy' : 'free')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${task.calendarShowAs === 'free' ? 'bg-white/10 text-white/60 ring-1 ring-white/20' : 'bg-white/[0.04] text-white/30 hover:text-white/50'}`}
                  >
                    {task.calendarShowAs === 'free' ? 'Free' : 'Busy'}
                  </button>
                  {/* Sync toggle */}
                  <button
                    onClick={() => update('calendarSync', !task.calendarSync)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${task.calendarSync ? 'bg-[#4285F4]/15 text-[#4285F4]' : 'bg-white/[0.04] text-white/25 hover:text-white/50'}`}
                  >
                    <Calendar size={11} />
                    {task.calendarSync ? 'Cal On' : 'Cal Off'}
                  </button>
                  {/* Sync status */}
                  {task.calendarSync && (
                    <div className="flex-1 flex items-center justify-end">
                      {calSyncing ? (
                        <span className="text-xs text-white/30 flex items-center gap-1"><RefreshCw size={10} className="animate-spin" /> Syncing…</span>
                      ) : calSynced ? (
                        <span className="text-xs text-emerald-400 flex items-center gap-1"><Check size={10} /> Synced</span>
                      ) : needsAuth ? (
                        <button onClick={() => doSync(true)} className="text-xs text-[#4285F4] hover:underline flex items-center gap-1">
                          <Calendar size={10} /> Authorize to sync
                        </button>
                      ) : task.calendarEventId ? (
                        <span className="text-xs text-white/20 flex items-center gap-1"><Check size={10} /> On calendar</span>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Flags */}
            <div>
              <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Flags</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { key: 'within72Hours',  label: '⚡ 72h Priority',     on: 'bg-red-500/15 text-red-400 ring-1 ring-red-500/25' },
                  { key: 'questionsForLev', label: '? Question for Lev', on: 'bg-purple-500/15 text-purple-400 ring-1 ring-purple-500/25' },
                  { key: 'updateAtCheckin', label: '✓ Sarah\'s Update',  on: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/25' },
                  { key: 'isPrivate',       label: '🔒 Private',          on: 'bg-white/10 text-white/60 ring-1 ring-white/20' },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => update(f.key as keyof Task, !(task as any)[f.key])}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${(task as any)[f.key] ? f.on : 'bg-white/[0.04] text-white/25 hover:text-white/50 hover:bg-white/[0.06]'}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* PROJECTS */}
            <div>
              <label className="text-xs font-semibold text-white/30 uppercase tracking-wider block mb-2">Projects</label>
              <div className="space-y-1">
                {projects.map(p => {
                  const included = task.projectIds?.includes(p.id) ?? false;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        const current = task.projectIds ?? [];
                        const next = included ? current.filter(id => id !== p.id) : [...current, p.id];
                        update('projectIds', next);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-left ${included ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'}`}
                    >
                      <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${included ? 'border-brand-400 bg-brand-500/20' : 'border-white/20'}`}>
                        {included && <span className="text-brand-400 text-[9px]">✓</span>}
                      </span>
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                      <span className={`text-sm ${included ? 'text-white/80' : 'text-white/40'}`}>{p.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Defer */}
            <div>
              <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Defer</p>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Mode toggle */}
                <div className="flex rounded-lg overflow-hidden border border-white/[0.08]">
                  <button
                    onClick={() => { if (task.waitDate) update('waitDate', undefined); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${!task.waitDate ? 'bg-white/[0.08] text-white/70' : 'text-white/30 hover:text-white/50 hover:bg-white/[0.04]'}`}
                  >
                    <BellOff size={11} /> Snooze
                  </button>
                  <button
                    onClick={() => { if (task.snoozeDate) update('snoozeDate', undefined); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${task.waitDate ? 'bg-white/[0.08] text-white/70' : 'text-white/30 hover:text-white/50 hover:bg-white/[0.04]'}`}
                  >
                    <Clock size={11} /> Waiting for
                  </button>
                </div>
                {/* Date picker */}
                {!task.waitDate ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={task.snoozeDate ? task.snoozeDate.slice(0, 10) : ''}
                      onChange={(e) => update('snoozeDate', e.target.value ? new Date(e.target.value + 'T00:00:00').toISOString() : undefined)}
                      className="px-2.5 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/60 focus:outline-none focus:border-brand-500/40"
                      style={{ colorScheme: 'dark' }}
                    />
                    {task.snoozeDate && (
                      <button onClick={() => update('snoozeDate', undefined)} className="text-white/20 hover:text-white/50 transition-colors"><X size={12} /></button>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={task.waitDate ? task.waitDate.slice(0, 10) : ''}
                      onChange={(e) => update('waitDate', e.target.value ? new Date(e.target.value + 'T00:00:00').toISOString() : undefined)}
                      className="px-2.5 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/60 focus:outline-none focus:border-brand-500/40"
                      style={{ colorScheme: 'dark' }}
                    />
                    {task.waitDate && (
                      <button onClick={() => update('waitDate', undefined)} className="text-white/20 hover:text-white/50 transition-colors"><X size={12} /></button>
                    )}
                  </div>
                )}
                {task.snoozeDate && !task.waitDate && (
                  <span className="text-xs text-white/30">Hidden until {format(new Date(task.snoozeDate), 'MMM d')}</span>
                )}
                {task.waitDate && (
                  <span className="text-xs text-white/30">Following up {format(new Date(task.waitDate), 'MMM d')}</span>
                )}
              </div>
            </div>

            {/* Reminders */}
            <div>
              <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Reminder</p>
              <div className="flex items-center gap-2 flex-wrap">
                {task.reminderAt ? (
                  <>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20 rounded-lg text-xs font-medium">
                      <Bell size={11} />
                      {format(new Date(task.reminderAt), 'MMM d, h:mm a')}
                      {task.reminderSent && <span className="ml-1 text-emerald-400/80">✓</span>}
                    </div>
                    {/* Edit date */}
                    <input
                      type="date"
                      value={task.reminderAt!.slice(0, 10)}
                      onChange={(e) => {
                        if (e.target.value) {
                          const time = format(new Date(task.reminderAt!), 'HH:mm');
                          update('reminderAt', new Date(e.target.value + 'T' + time).toISOString());
                          update('reminderSent', false);
                        }
                      }}
                      className="px-2.5 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/60 focus:outline-none focus:border-brand-500/40"
                      style={{ colorScheme: 'dark' }}
                    />
                    {/* Edit time */}
                    <input
                      type="time"
                      value={format(new Date(task.reminderAt), 'HH:mm')}
                      onChange={(e) => {
                        if (e.target.value) {
                          const base = task.reminderAt!.slice(0, 10);
                          update('reminderAt', new Date(base + 'T' + e.target.value).toISOString());
                          update('reminderSent', false);
                        }
                      }}
                      className="px-2.5 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/60 focus:outline-none focus:border-brand-500/40"
                      style={{ colorScheme: 'dark' }}
                    />
                    <button onClick={() => { update('reminderAt', undefined); update('reminderSent', undefined); }} className="text-white/40 hover:text-white/70 transition-colors"><X size={14} /></button>
                    {task.reminderSent && <span className="text-xs text-emerald-400/60">Sent</span>}
                  </>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          update('reminderAt', new Date(e.target.value + 'T09:00:00').toISOString());
                          update('reminderSent', false);
                        }
                      }}
                      className="px-2.5 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/60 focus:outline-none focus:border-brand-500/40"
                      style={{ colorScheme: 'dark' }}
                    />
                    <span className="text-xs text-white/20">pick a date to set a text reminder</span>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <p className="text-xs text-white/30 uppercase tracking-wider mb-2">Notes</p>
              <textarea
                value={task.description || ''}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Add notes, context, links..."
                rows={4}
                className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-sm text-white/70 placeholder-white/20 focus:outline-none focus:border-brand-500/30 resize-none"
              />
            </div>

            {/* Attachments */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-white/30 uppercase tracking-wider">Attachments</p>
                <div className="flex items-center gap-3">
                  <button onClick={openDrivePicker} disabled={driveLoading} className="flex items-center gap-1 text-xs text-white/30 hover:text-[#4285F4] transition-colors disabled:opacity-40">
                    <Cloud size={11} /> {driveLoading ? 'Opening...' : 'Drive'}
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 text-xs text-white/30 hover:text-brand-400 transition-colors">
                    <Paperclip size={11} /> Upload
                  </button>
                </div>
              </div>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} accept="image/*,.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg" />
              {(task.attachments || []).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {(task.attachments || []).map((att: any) => (
                    <div key={att.id} className="group relative">
                      {att.source === 'google_drive' ? (
                        <a href={att.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:border-[#4285F4]/40 text-xs text-white/50 hover:text-white/80 transition-colors max-w-[180px]">
                          <Cloud size={13} className="text-[#4285F4] flex-shrink-0" />
                          <span className="truncate">{att.name}</span>
                        </a>
                      ) : att.type.startsWith('image/') ? (
                        <a href={att.url} target="_blank" rel="noopener noreferrer">
                          <img src={att.url} alt={att.name} className="w-20 h-20 rounded-xl object-cover border border-white/10 hover:border-white/30 transition-colors cursor-pointer" />
                        </a>
                      ) : (
                        <a href={att.url} download={att.name} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:border-white/15 text-xs text-white/50 hover:text-white/70 transition-colors">
                          <FileText size={13} />
                          <span className="max-w-[120px] truncate">{att.name}</span>
                        </a>
                      )}
                    </div>
                  ))}
                  <button onClick={() => fileInputRef.current?.click()} className="w-20 h-20 rounded-xl border border-dashed border-white/[0.08] hover:border-white/20 text-white/20 hover:text-white/40 text-xs flex items-center justify-center transition-colors">
                    +
                  </button>
                </div>
              ) : (
                <div className="w-full border border-dashed border-white/[0.08] rounded-xl py-5 flex flex-col items-center justify-center gap-2">
                  <div className="flex items-center gap-3">
                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 text-xs text-white/20 hover:text-white/40 transition-colors">
                      <Paperclip size={13} /> Upload file
                    </button>
                    <span className="text-white/10 text-xs">or</span>
                    <button onClick={openDrivePicker} disabled={driveLoading} className="flex items-center gap-1.5 text-xs text-white/20 hover:text-[#4285F4] transition-colors disabled:opacity-40">
                      <Cloud size={13} /> Attach from Drive
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Comments */}
            <div>
              <p className="text-xs text-white/30 uppercase tracking-wider mb-3">
                Comments {task.comments.length > 0 && <span className="opacity-50 ml-1">{task.comments.length}</span>}
              </p>

              {task.comments.length > 0 && (
                <div className="space-y-4 mb-4">
                  {task.comments.map(c => {
                    const author = users.find(u => u.id === c.authorId);
                    return (
                      <div key={c.id} className="flex gap-3">
                        <div className="w-7 h-7 rounded-full bg-brand-600/40 flex items-center justify-center text-xs font-bold text-brand-300 flex-shrink-0 mt-0.5">
                          {author?.name[0] || '?'}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold text-white/60">{author?.name || 'Unknown'}</span>
                            <span className="text-[10px] text-white/20">{format(new Date(c.createdAt), 'MMM d, h:mm a')}</span>
                          </div>
                          <p className="text-sm text-white/70 bg-white/[0.03] rounded-xl px-4 py-2.5 border border-white/[0.05] leading-relaxed">{c.body}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Comment input */}
              <div className="flex gap-3 items-start">
                <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5">
                  {currentUser.name[0]}
                </div>
                <div className="flex-1">
                  <textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                    placeholder="Add a comment... (Enter to post)"
                    rows={2}
                    className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-white/80 placeholder-white/20 focus:outline-none focus:border-brand-500/30 resize-none"
                  />
                  {commentText.trim() && (
                    <button onClick={handleAddComment} className="mt-2 px-4 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs rounded-lg transition-colors">
                      Post comment
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Footer space */}
            <div className="h-4" />
          </div>
        </div>
      </div>
    </>
  );
}
