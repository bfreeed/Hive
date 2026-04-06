import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStore } from '../store';
import { X, Trash2, Paperclip, FileText, Lock, Cloud, Calendar, Check, RefreshCw, Clock, BellOff, Bell, Plus, GitBranch, Link2, ChevronDown, ChevronRight, CircleDot, AlertCircle, Users, FolderOpen, Tag } from 'lucide-react';
import type { Task, TaskStatus, Priority } from '../types';
import { format } from 'date-fns';
import { useGooglePicker } from '../hooks/useGooglePicker';
import { syncTaskToCalendar, deleteCalendarEvent, hasCalendarToken, listCalendars, type CalendarEntry } from '../hooks/useGoogleCalendar';
import { flattenProjects } from '../lib/projectUtils';

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

function PropRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start min-h-[32px] group/prop">
      <div className="flex items-center gap-2 w-20 md:w-32 flex-shrink-0 text-white/30 text-sm py-1 mt-0.5">
        <span className="flex-shrink-0">{icon}</span>
        <span className="text-xs">{label}</span>
      </div>
      <div className="flex-1 py-0.5 min-w-0">{children}</div>
    </div>
  );
}

export default function TaskDetail({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { tasks, projects, users, currentUser, sections, updateTask, deleteTask, addComment, addTask } = useStore();
  const task = tasks.find(t => t.id === taskId);
  const [commentText, setCommentText] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);
  const [showSubtasks, setShowSubtasks] = useState(true);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [showNewSubtask, setShowNewSubtask] = useState(false);
  const [showDeps, setShowDeps] = useState(true);
  const [depSearch, setDepSearch] = useState('');
  const [showDepPicker, setShowDepPicker] = useState(false);
  const [calSyncing, setCalSyncing] = useState(false);
  const [calSynced, setCalSynced] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [showCalPicker, setShowCalPicker] = useState(false);
  const [calList, setCalList] = useState<CalendarEntry[]>([]);
  const [calListLoading, setCalListLoading] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [reminderUnit, setReminderUnit] = useState<'minutes' | 'hours' | 'days' | 'weeks'>('minutes');
  const [reminderValue, setReminderValue] = useState<string>('30');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prevDueDateRef = useRef<string | undefined>(undefined);
  const dateInputRef = useRef<HTMLInputElement>(null);

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

  const openCalPicker = useCallback(async () => {
    setShowCalPicker(true);
    if (calList.length > 0) return; // already loaded
    setCalListLoading(true);
    try {
      const entries = await listCalendars(false);
      setCalList(entries);
    } catch {
      // token needed — will show empty, user can still dismiss
    } finally {
      setCalListLoading(false);
    }
  }, [calList.length]);

  // Auto-sync when dueDate changes (if calendarSync is on and token is cached)
  useEffect(() => {
    if (!task) return;
    const prev = prevDueDateRef.current;
    const curr = task.dueDate;
    prevDueDateRef.current = curr;

    if (prev === undefined) return; // skip initial mount

    if (!curr && task.calendarEventId) {
      // Due date removed — delete calendar event
      deleteCalendarEvent(task.calendarEventId, task.calendarId).then(() => {
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

  const currentStatus = STATUS_OPTIONS.find(s => s.value === task.status);
  const currentPriority = PRIORITY_OPTIONS.find(p => p.value === task.priority);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Slide-over panel */}
      <div className="fixed inset-0 md:inset-auto md:right-0 md:top-0 md:bottom-0 z-50 w-full md:w-[600px] bg-[#111113] md:border-l border-white/[0.08] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-white/[0.06] flex-shrink-0 pt-safe">
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
          <div className="px-4 md:px-6 py-4 md:py-5 pb-20 md:pb-5">

            {/* Title */}
            <textarea
              className="w-full bg-transparent text-xl md:text-2xl font-semibold text-white resize-none focus:outline-none placeholder-white/20 leading-snug mt-2 mb-1"
              value={task.title}
              onChange={(e) => update('title', e.target.value)}
              rows={task.title.length > 55 ? 2 : 1}
              placeholder="Task title..."
            />

            {/* Properties table */}
            <div className="mt-4 space-y-0.5">

              {/* Status */}
              <PropRow icon={<CircleDot size={13} />} label="Status">
                <div className="flex flex-wrap items-center gap-1.5">
                  {currentStatus && (
                    <button
                      onClick={() => setShowStatusPicker(v => !v)}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${currentStatus.active}`}
                    >
                      {currentStatus.label}
                    </button>
                  )}
                  {showStatusPicker && (
                    <div className="flex flex-wrap gap-1">
                      {STATUS_OPTIONS.filter(s => s.value !== task.status).map(s => (
                        <button
                          key={s.value}
                          onClick={() => { update('status', s.value); setShowStatusPicker(false); }}
                          className="px-3 py-1 rounded-lg text-xs font-medium text-white/30 hover:text-white/60 bg-white/[0.04] hover:bg-white/[0.06] transition-colors"
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </PropRow>

              {/* Priority */}
              <PropRow icon={<AlertCircle size={13} />} label="Priority">
                <div className="flex flex-wrap items-center gap-1.5">
                  {currentPriority && (
                    <button
                      onClick={() => setShowPriorityPicker(v => !v)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${currentPriority.active}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${currentPriority.dot}`} />
                      {currentPriority.label}
                    </button>
                  )}
                  {showPriorityPicker && (
                    <div className="flex flex-wrap gap-1">
                      {PRIORITY_OPTIONS.filter(p => p.value !== task.priority).map(p => (
                        <button
                          key={p.value}
                          onClick={() => { update('priority', p.value); setShowPriorityPicker(false); }}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium text-white/30 hover:text-white/60 bg-white/[0.04] hover:bg-white/[0.06] transition-colors"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.dot}`} />
                          {p.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </PropRow>

              {/* Due */}
              <PropRow icon={<Calendar size={13} />} label="Due">
                <div className="flex flex-wrap items-center gap-1.5">
                  <div
                    className="relative px-2.5 py-1 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/60 cursor-pointer hover:border-white/[0.15] transition-colors"
                    onClick={() => dateInputRef.current?.showPicker()}
                  >
                    <span>{task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Pick a date'}</span>
                    <input
                      ref={dateInputRef}
                      type="date"
                      value={task.dueDate ? task.dueDate.slice(0, 10) : ''}
                      onChange={(e) => update('dueDate', e.target.value ? new Date(e.target.value + 'T12:00:00').toISOString() : undefined)}
                      autoComplete="off"
                      data-1p-ignore
                      data-lpignore="true"
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                      style={{ colorScheme: 'dark' }}
                    />
                  </div>
                  {task.dueDate && !task.dueTime && (
                    <button
                      onClick={() => update('dueTime', '09:00')}
                      className="px-2 py-1 rounded-lg text-xs text-white/30 hover:text-white/60 bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
                    >
                      + Add time
                    </button>
                  )}
                  {task.dueTime && (
                    <>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-white/25">Start</span>
                        <input
                          type="time"
                          value={task.dueTime || ''}
                          onChange={(e) => update('dueTime', e.target.value || undefined)}
                          autoComplete="off"
                          data-1p-ignore
                          data-lpignore="true"
                          className="px-2.5 py-1 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/60 focus:outline-none focus:border-brand-500/40"
                          style={{ colorScheme: 'dark' }}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-white/25">End</span>
                        <input
                          type="time"
                          value={task.dueTimeEnd || ''}
                          onChange={(e) => update('dueTimeEnd', e.target.value || undefined)}
                          autoComplete="off"
                          data-1p-ignore
                          data-lpignore="true"
                          className="px-2.5 py-1 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/60 focus:outline-none focus:border-brand-500/40"
                          style={{ colorScheme: 'dark' }}
                          placeholder="optional"
                        />
                      </div>
                      <button
                        onClick={() => { update('dueTime', undefined); update('dueTimeEnd', undefined); }}
                        className="px-2 py-1 rounded-lg text-xs text-white/30 hover:text-white/70 bg-white/[0.04] hover:bg-white/[0.08] transition-colors"
                      >
                        All day
                      </button>
                    </>
                  )}
                  {/* Calendar sync */}
                  <button
                    onClick={() => update('calendarSync', !task.calendarSync)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${task.calendarSync ? 'bg-[#4285F4]/15 text-[#4285F4]' : 'bg-white/[0.04] text-white/25 hover:text-white/50'}`}
                  >
                    <Calendar size={10} />
                    {task.calendarSync ? 'Cal On' : 'Cal'}
                  </button>
                  {task.calendarSync && (
                    <>
                      {/* Calendar picker */}
                      <div className="relative">
                        <button
                          onClick={openCalPicker}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-white/40 hover:text-white/70 bg-white/[0.04] hover:bg-white/[0.07] transition-colors max-w-[120px]"
                          title="Choose calendar"
                        >
                          {calList.find(c => c.id === task.calendarId) ? (
                            <>
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: calList.find(c => c.id === task.calendarId)?.backgroundColor || '#4285F4' }}
                              />
                              <span className="truncate">{calList.find(c => c.id === task.calendarId)?.summary}</span>
                            </>
                          ) : (
                            <span className="truncate">{task.calendarId && task.calendarId !== 'primary' ? task.calendarId : 'Primary'}</span>
                          )}
                          <ChevronDown size={9} className="flex-shrink-0 opacity-50" />
                        </button>
                        {showCalPicker && (
                          <div className="absolute top-full left-0 mt-1 w-52 bg-[#1c1c1f] border border-white/[0.08] rounded-xl shadow-xl z-30 py-1 max-h-56 overflow-y-auto">
                            <div className="flex items-center justify-between px-3 pt-1 pb-1.5 border-b border-white/[0.06]">
                              <span className="text-[10px] font-semibold text-white/30 uppercase tracking-wider">Choose calendar</span>
                              <button onClick={() => setShowCalPicker(false)} className="text-white/30 hover:text-white/60"><X size={12} /></button>
                            </div>
                            {calListLoading && (
                              <div className="flex items-center justify-center py-4">
                                <RefreshCw size={13} className="animate-spin text-white/30" />
                              </div>
                            )}
                            {!calListLoading && calList.length === 0 && (
                              <p className="text-xs text-white/30 px-3 py-3">No calendars found. Make sure you're signed in.</p>
                            )}
                            {calList.map(cal => (
                              <button
                                key={cal.id}
                                onClick={() => {
                                  update('calendarId', cal.id);
                                  setShowCalPicker(false);
                                  // Re-sync to the new calendar if already synced
                                  if (task.calendarEventId) {
                                    deleteCalendarEvent(task.calendarEventId, task.calendarId)
                                      .then(() => updateTask(taskId, { calendarEventId: undefined, calendarId: cal.id }))
                                      .then(() => doSync(false));
                                  }
                                }}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors hover:bg-white/[0.06] ${task.calendarId === cal.id || (!task.calendarId && cal.primary) ? 'text-white/90' : 'text-white/55'}`}
                              >
                                <span
                                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: cal.backgroundColor || '#4285F4' }}
                                />
                                <span className="truncate flex-1 text-left">{cal.summary}</span>
                                {(task.calendarId === cal.id || (!task.calendarId && cal.primary)) && (
                                  <Check size={11} className="text-[#4285F4] flex-shrink-0" />
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {/* Sync status */}
                      {calSyncing ? (
                        <span className="text-xs text-white/30 flex items-center gap-1"><RefreshCw size={10} className="animate-spin" /> Syncing…</span>
                      ) : calSynced ? (
                        <span className="text-xs text-emerald-400 flex items-center gap-1"><Check size={10} /> Synced</span>
                      ) : needsAuth ? (
                        <button onClick={() => doSync(true)} className="text-xs text-[#4285F4] hover:underline flex items-center gap-1">
                          <Calendar size={10} /> Authorize
                        </button>
                      ) : task.calendarEventId ? (
                        <span className="text-xs text-white/20 flex items-center gap-1"><Check size={10} /> On calendar</span>
                      ) : null}
                    </>
                  )}
                </div>
              </PropRow>

              {/* Assignees */}
              <PropRow icon={<Users size={13} />} label="Assignees">
                <div className="flex flex-wrap gap-1.5">
                  {users.map(u => {
                    const assigned = task.assigneeIds.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        onClick={() => update('assigneeIds', assigned ? task.assigneeIds.filter(id => id !== u.id) : [...task.assigneeIds, u.id])}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${assigned ? 'bg-brand-600/25 text-brand-300 ring-1 ring-brand-500/30' : 'bg-white/[0.04] text-white/35 hover:text-white/70 hover:bg-white/[0.07]'}`}
                      >
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${assigned ? 'bg-brand-600' : 'bg-white/15'}`}>
                          {u.name[0]}
                        </div>
                        {u.name.split(' ')[0]}
                      </button>
                    );
                  })}
                </div>
              </PropRow>

              {/* Projects */}
              <PropRow icon={<FolderOpen size={13} />} label="Projects">
                <div className="flex flex-wrap gap-1.5">
                  {projects.filter(p => task.projectIds?.includes(p.id)).map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        const current = task.projectIds ?? [];
                        update('projectIds', current.filter(id => id !== p.id));
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors"
                      style={{ backgroundColor: p.color + '22', color: p.color }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                      {p.name}
                      <X size={10} className="opacity-50" />
                    </button>
                  ))}
                  <button
                    onClick={() => setShowProjectPicker(v => !v)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-white/25 hover:text-white/50 bg-white/[0.04] hover:bg-white/[0.06] transition-colors"
                  >
                    <Plus size={10} />
                  </button>
                  {showProjectPicker && (
                    <div className="flex flex-col gap-0.5 min-w-[160px]">
                      {flattenProjects(projects).filter(({ project: p }) => !(task.projectIds ?? []).includes(p.id)).map(({ project: p, depth }) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            const current = task.projectIds ?? [];
                            update('projectIds', [...current, p.id]);
                            setShowProjectPicker(false);
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors bg-white/[0.04] hover:bg-white/[0.07] text-white/40 hover:text-white/70 text-left"
                          style={{ paddingLeft: depth > 0 ? `${0.625 + depth * 0.75}rem` : undefined }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                          {p.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </PropRow>

              {/* Repeat */}
              <PropRow icon={<RefreshCw size={13} />} label="Repeat">
                <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.06] rounded-xl p-0.5 w-fit">
                  {([undefined, 'daily', 'weekly', 'monthly'] as const).map((r) => {
                    const label = r === undefined ? 'Never' : r.charAt(0).toUpperCase() + r.slice(1);
                    const active = (task.recurring ?? undefined) === r;
                    return (
                      <button
                        key={label}
                        onClick={() => update('recurring', r)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${active ? 'bg-white/[0.10] text-white' : 'text-white/40 hover:text-white/70'}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </PropRow>

              {/* Reminder */}
              <PropRow icon={<Bell size={13} />} label="Reminder">
                <div className="flex items-center gap-1.5">
                  {task.reminderMinutes != null ? (
                    <>
                      <input
                        type="number"
                        min={1}
                        value={reminderValue}
                        onChange={e => {
                          setReminderValue(e.target.value);
                          const n = parseInt(e.target.value);
                          if (!isNaN(n) && n > 0) {
                            const multipliers = { minutes: 1, hours: 60, days: 1440, weeks: 10080 };
                            update('reminderMinutes', n * multipliers[reminderUnit]);
                          }
                        }}
                        className="w-16 px-2.5 py-1 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/60 focus:outline-none focus:border-brand-500/40"
                      />
                      <select
                        value={reminderUnit}
                        onChange={e => {
                          const unit = e.target.value as typeof reminderUnit;
                          setReminderUnit(unit);
                          const n = parseInt(reminderValue);
                          if (!isNaN(n) && n > 0) {
                            const multipliers = { minutes: 1, hours: 60, days: 1440, weeks: 10080 };
                            update('reminderMinutes', n * multipliers[unit]);
                          }
                        }}
                        className="px-2.5 py-1 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/60 focus:outline-none focus:border-brand-500/40"
                      >
                        <option value="minutes">minutes</option>
                        <option value="hours">hours</option>
                        <option value="days">days</option>
                        <option value="weeks">weeks</option>
                      </select>
                      <span className="text-xs text-white/25">before</span>
                      <button onClick={() => update('reminderMinutes', undefined)} className="text-white/30 hover:text-white/60 transition-colors"><X size={12} /></button>
                    </>
                  ) : (
                    <button
                      onClick={() => { update('reminderMinutes', 30); setReminderValue('30'); setReminderUnit('minutes'); }}
                      className="px-2.5 py-1 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/40 hover:text-white/60 transition-colors"
                    >
                      Add reminder
                    </button>
                  )}
                </div>
              </PropRow>

              {/* Defer */}
              <PropRow icon={<Clock size={13} />} label="Defer">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="flex rounded-lg overflow-hidden border border-white/[0.08]">
                    <button
                      onClick={() => { if (task.waitDate) update('waitDate', undefined); }}
                      className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-colors ${!task.waitDate ? 'bg-white/[0.08] text-white/70' : 'text-white/30 hover:text-white/50 hover:bg-white/[0.04]'}`}
                    >
                      <BellOff size={10} /> Snooze
                    </button>
                    <button
                      onClick={() => { if (task.snoozeDate) update('snoozeDate', undefined); }}
                      className={`flex items-center gap-1 px-2.5 py-1 text-xs font-medium transition-colors ${task.waitDate ? 'bg-white/[0.08] text-white/70' : 'text-white/30 hover:text-white/50 hover:bg-white/[0.04]'}`}
                    >
                      <Clock size={10} /> Waiting for
                    </button>
                  </div>
                  {!task.waitDate ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="date"
                        value={task.snoozeDate ? task.snoozeDate.slice(0, 10) : ''}
                        onChange={(e) => update('snoozeDate', e.target.value ? new Date(e.target.value + 'T00:00:00').toISOString() : undefined)}
                        className="px-2 py-1 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/60 focus:outline-none focus:border-brand-500/40"
                        style={{ colorScheme: 'dark' }}
                      />
                      {task.snoozeDate && (
                        <button onClick={() => update('snoozeDate', undefined)} className="text-white/20 hover:text-white/50 transition-colors"><X size={11} /></button>
                      )}
                      {task.snoozeDate && <span className="text-xs text-white/30">Hidden until {format(new Date(task.snoozeDate), 'MMM d')}</span>}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <input
                        type="date"
                        value={task.waitDate ? task.waitDate.slice(0, 10) : ''}
                        onChange={(e) => update('waitDate', e.target.value ? new Date(e.target.value + 'T00:00:00').toISOString() : undefined)}
                        className="px-2 py-1 bg-white/[0.04] border border-white/[0.08] rounded-lg text-xs text-white/60 focus:outline-none focus:border-brand-500/40"
                        style={{ colorScheme: 'dark' }}
                      />
                      {task.waitDate && (
                        <button onClick={() => update('waitDate', undefined)} className="text-white/20 hover:text-white/50 transition-colors"><X size={11} /></button>
                      )}
                      {task.waitDate && <span className="text-xs text-white/30">Following up {format(new Date(task.waitDate), 'MMM d')}</span>}
                    </div>
                  )}
                </div>
              </PropRow>

              {/* Flags */}
              <PropRow icon={<Tag size={13} />} label="Flags">
                <div className="flex flex-wrap gap-1.5">
                  {(currentUser.flags || []).map(f => {
                    const active = task.flags.some(tf => tf.flagId === f.id && tf.appliedBy === currentUser.id);
                    return (
                      <button
                        key={f.id}
                        onClick={() => {
                          const next = active
                            ? task.flags.filter(tf => !(tf.flagId === f.id && tf.appliedBy === currentUser.id))
                            : [...task.flags, { flagId: f.id, appliedBy: currentUser.id }];
                          update('flags', next);
                        }}
                        style={active ? { backgroundColor: f.color + '25', color: f.color, boxShadow: `0 0 0 1px ${f.color}40` } : {}}
                        className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${active ? '' : 'bg-white/[0.04] text-white/25 hover:text-white/50 hover:bg-white/[0.06]'}`}
                      >
                        {f.name}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => update('isPrivate', !task.isPrivate)}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${task.isPrivate ? 'bg-white/10 text-white/60 ring-1 ring-white/20' : 'bg-white/[0.04] text-white/25 hover:text-white/50 hover:bg-white/[0.06]'}`}
                  >
                    🔒 Private
                  </button>
                  {task.flags.filter(tf => tf.appliedBy !== currentUser.id).map(tf => {
                    const applier = users.find(u => u.id === tf.appliedBy);
                    const flagDef = applier?.flags?.find(fd => fd.id === tf.flagId);
                    if (!flagDef) return null;
                    return (
                      <span
                        key={`${tf.flagId}-${tf.appliedBy}`}
                        className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-white/[0.04]"
                        style={{ color: flagDef.color + 'aa' }}
                      >
                        <span>{flagDef.name}</span>
                        <span className="text-white/20 text-[10px]">by {applier?.name.split(' ')[0]}</span>
                        <button
                          onClick={() => update('flags', task.flags.filter(f => !(f.flagId === tf.flagId && f.appliedBy === tf.appliedBy)))}
                          className="ml-0.5 text-white/20 hover:text-white/50 transition-colors"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              </PropRow>

            </div>

            {/* Divider */}
            <div className="border-t border-white/[0.06] my-4" />

            {/* Notes */}
            <textarea
              value={task.description || ''}
              onChange={(e) => update('description', e.target.value)}
              placeholder="Add notes, context, links..."
              rows={4}
              className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.06] rounded-xl text-sm text-white/70 placeholder-white/20 focus:outline-none focus:border-brand-500/30 resize-none"
            />

            {/* Attachments */}
            <div className="mt-4">
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

            {/* Subtasks */}
            {!task.parentId && (() => {
              const subtasks = tasks.filter(t => t.parentId === taskId);
              const doneCount = subtasks.filter(t => t.status === 'done').length;
              return (
                <div className="mt-6 pt-5 border-t border-white/[0.06]">
                  <button
                    onClick={() => setShowSubtasks(v => !v)}
                    className="flex items-center gap-2 w-full mb-3 group"
                  >
                    {showSubtasks ? <ChevronDown size={13} className="text-white/30" /> : <ChevronRight size={13} className="text-white/30" />}
                    <GitBranch size={13} className="text-white/40" />
                    <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Subtasks</span>
                    {subtasks.length > 0 && (
                      <span className="text-xs text-white/30 ml-1">{doneCount}/{subtasks.length}</span>
                    )}
                  </button>
                  {showSubtasks && (
                    <div className="space-y-1">
                      {subtasks.map(sub => (
                        <div key={sub.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.03] group/sub">
                          <button
                            onClick={() => updateTask(sub.id, { status: sub.status === 'done' ? 'todo' : 'done', completedAt: sub.status !== 'done' ? new Date().toISOString() : undefined })}
                            className={`w-3.5 h-3.5 rounded border-2 flex-shrink-0 transition-colors ${sub.status === 'done' ? 'border-emerald-500 bg-emerald-500/20' : 'border-white/20 hover:border-brand-400'}`}
                          >
                            {sub.status === 'done' && <span className="text-emerald-400 text-[7px] flex items-center justify-center">✓</span>}
                          </button>
                          <span className={`flex-1 text-sm ${sub.status === 'done' ? 'line-through text-white/25' : 'text-white/70'}`}>{sub.title}</span>
                          <button
                            onClick={() => deleteTask(sub.id)}
                            className="opacity-0 group-hover/sub:opacity-100 p-0.5 text-white/20 hover:text-red-400 transition-all"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                      {showNewSubtask ? (
                        <div className="flex items-center gap-2 px-2 py-1.5 bg-white/[0.03] border border-brand-500/30 rounded-lg">
                          <input
                            autoFocus
                            value={newSubtaskTitle}
                            onChange={e => setNewSubtaskTitle(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && newSubtaskTitle.trim()) {
                                addTask({ title: newSubtaskTitle.trim(), parentId: taskId, projectIds: task.projectIds, sectionId: task.sectionId, status: 'todo', priority: 'medium', assigneeIds: [currentUser.id], flags: [], isPrivate: false, linkedContactIds: [], linkedDocIds: [] });
                                setNewSubtaskTitle('');
                                setShowNewSubtask(false);
                              }
                              if (e.key === 'Escape') { setShowNewSubtask(false); setNewSubtaskTitle(''); }
                            }}
                            placeholder="Subtask title..."
                            className="flex-1 bg-transparent text-sm text-white/80 placeholder-white/25 focus:outline-none"
                          />
                          <button onClick={() => { setShowNewSubtask(false); setNewSubtaskTitle(''); }} className="text-white/30 hover:text-white/60">
                            <X size={11} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowNewSubtask(true)}
                          className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-white/30 hover:text-white/60 transition-colors rounded-lg hover:bg-white/[0.03] w-full"
                        >
                          <Plus size={12} /> Add subtask
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Dependencies */}
            {(() => {
              const deps = (task.dependsOn ?? []).map(id => tasks.find(t => t.id === id)).filter(Boolean) as typeof tasks;
              const depSearchLower = depSearch.toLowerCase();
              const depCandidates = tasks.filter(t =>
                t.id !== taskId &&
                !t.parentId &&
                t.status !== 'done' &&
                !(task.dependsOn ?? []).includes(t.id) &&
                (!depSearch || t.title.toLowerCase().includes(depSearchLower))
              ).slice(0, 8);
              return (
                <div className="mt-6 pt-5 border-t border-white/[0.06]">
                  <button
                    onClick={() => setShowDeps(v => !v)}
                    className="flex items-center gap-2 w-full mb-3"
                  >
                    {showDeps ? <ChevronDown size={13} className="text-white/30" /> : <ChevronRight size={13} className="text-white/30" />}
                    <Link2 size={13} className="text-white/40" />
                    <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">Blocked by</span>
                    {deps.length > 0 && <span className="text-xs text-white/30 ml-1">{deps.length}</span>}
                  </button>
                  {showDeps && (
                    <div className="space-y-1">
                      {deps.map(dep => (
                        <div key={dep.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.03] group/dep">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dep.status === 'done' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                          <span className="flex-1 text-sm text-white/60 truncate">{dep.title}</span>
                          <span className="text-[10px] text-white/25 capitalize">{dep.status}</span>
                          <button
                            onClick={() => updateTask(taskId, { dependsOn: (task.dependsOn ?? []).filter(id => id !== dep.id) })}
                            className="opacity-0 group-hover/dep:opacity-100 p-0.5 text-white/20 hover:text-red-400 transition-all"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                      {showDepPicker ? (
                        <div className="mt-1 p-2 bg-white/[0.04] border border-white/[0.08] rounded-xl space-y-1">
                          <input
                            autoFocus
                            value={depSearch}
                            onChange={e => setDepSearch(e.target.value)}
                            placeholder="Search tasks..."
                            className="w-full bg-transparent text-xs text-white/80 placeholder-white/25 focus:outline-none px-1"
                          />
                          {depCandidates.length === 0 ? (
                            <p className="text-xs text-white/25 px-1 py-1">No matching tasks</p>
                          ) : (
                            depCandidates.map(t => (
                              <button
                                key={t.id}
                                onClick={() => { updateTask(taskId, { dependsOn: [...(task.dependsOn ?? []), t.id] }); setDepSearch(''); setShowDepPicker(false); }}
                                className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.06] text-xs text-white/60 hover:text-white/80 transition-colors"
                              >
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.priority === 'urgent' ? 'bg-red-400' : t.priority === 'high' ? 'bg-orange-400' : 'bg-yellow-400'}`} />
                                {t.title}
                              </button>
                            ))
                          )}
                          <button onClick={() => { setShowDepPicker(false); setDepSearch(''); }} className="text-xs text-white/25 hover:text-white/50 mt-1 px-1">Cancel</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowDepPicker(true)}
                          className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-white/30 hover:text-white/60 transition-colors rounded-lg hover:bg-white/[0.03] w-full"
                        >
                          <Plus size={12} /> Add dependency
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Comments */}
            <div className="mt-6 pt-5 border-t border-white/[0.06]">
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
