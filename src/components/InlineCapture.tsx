import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '../store';
import { flattenProjects } from '../lib/projectUtils';
import type { TaskFlag } from '../types';

export interface InlineCaptureHandle {
  open: () => void;
}

export interface InlineCaptureProps {
  initialTitle?: string;
  initialProjectId?: string;
  initialAssigneeId?: string;
  onCreated?: () => void;
  onCancel?: () => void;
  onOpenDetail?: (taskId: string) => void;
  /** When false, the collapsed button is hidden and the form auto-opens. Default: true */
  showCollapsedButton?: boolean;
}

const InlineCapture = forwardRef<InlineCaptureHandle, InlineCaptureProps>(function InlineCapture(props, ref) {
  const { initialTitle, initialProjectId, initialAssigneeId, onCreated, onCancel, showCollapsedButton = true } = props;
  const { projects, users, currentUser, addTask } = useStore();
  const [show, setShow] = useState(!showCollapsedButton);
  const containerRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    open: () => {
      setShow(true);
      setTimeout(() => containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
    },
  }));

  const [title, setTitle] = useState(initialTitle ?? '');
  const [project, setProject] = useState(initialProjectId ?? '');
  const [priority, setPriority] = useState<'urgent' | 'high' | 'medium' | 'low'>('medium');
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState(initialAssigneeId ?? currentUser.id);
  const [showMore, setShowMore] = useState(false);
  const [description, setDescription] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [dueTimeEnd, setDueTimeEnd] = useState('');
  const [reminderMinutes, setReminderMinutes] = useState<string>('');
  const [selectedFlagIds, setSelectedFlagIds] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (show) inputRef.current?.focus(); }, [show]);

  const buildTask = () => {
    const selectedProject = projects.find(p => p.id === project);
    const taskFlags: TaskFlag[] = selectedFlagIds.map(flagId => ({ flagId, appliedBy: currentUser.id }));
    const parsedReminder = reminderMinutes.trim() ? parseInt(reminderMinutes, 10) : undefined;
    return {
      title: title.trim() || 'New task',
      description: description.trim() || undefined,
      projectIds: project ? [project] : [],
      status: 'todo' as const,
      priority,
      assigneeIds: [assigneeId],
      dueDate: dueDate || undefined,
      dueTime: dueTime || undefined,
      dueTimeEnd: dueTimeEnd || undefined,
      reminderMinutes: Number.isFinite(parsedReminder) ? parsedReminder : undefined,
      flags: taskFlags,
      isPrivate: selectedProject?.isPrivate ?? false,
      linkedContactIds: [], linkedDocIds: [],
    };
  };

  const handleCapture = () => {
    if (!title.trim()) return;
    addTask(buildTask());
    onCreated?.();
    resetFields();
  };

  const resetFields = () => {
    setShow(false);
    setTitle(initialTitle ?? '');
    setProject(initialProjectId ?? '');
    setPriority('medium');
    setDueDate('');
    setAssigneeId(initialAssigneeId ?? currentUser.id);
    setShowMore(false);
    setDescription('');
    setDueTime('');
    setDueTimeEnd('');
    setReminderMinutes('');
    setSelectedFlagIds([]);
  };

  const handleCancel = () => {
    onCancel?.();
    resetFields();
  };

  if (!show) {
    if (!showCollapsedButton) return null;
    return (
      <button
        onClick={() => setShow(true)}
        className="w-full h-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/40 hover:border-white/55 text-white/40 hover:text-white/60 text-sm transition-colors"
      >
        <Plus size={14} /> New Task… <span className="ml-auto text-xs font-mono bg-white/[0.06] px-1.5 py-0.5 rounded">N</span>
      </button>
    );
  }

  const selectClass = 'text-xs bg-white/[0.06] border border-white/[0.08] rounded-lg px-2 py-1.5 text-white/60 focus:outline-none';

  return (
    <div ref={containerRef} className="bg-white/[0.04] rounded-xl border border-brand-500/30 overflow-hidden">
      {/* Title row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <input
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleCapture();
            if (e.key === 'Escape') handleCancel();
          }}
          placeholder="What needs to be done?"
          className="flex-1 bg-transparent text-sm text-white placeholder-white/20 focus:outline-none"
        />
        <button onClick={handleCapture} className="px-3 py-1.5 bg-brand-600 text-white text-xs rounded-lg hover:bg-brand-500 transition-colors">Add</button>
        <button onClick={handleCancel} className="p-1.5 text-white/30 hover:text-white/60 transition-colors">
          <X size={14} />
        </button>
      </div>

      {/* Fields row */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-white/[0.06] flex-wrap">
        <select value={project} onChange={e => setProject(e.target.value)} className={selectClass}>
          <option value="">No project</option>
          {flattenProjects(projects).map(({ project: p, depth }) => (
            <option key={p.id} value={p.id}>
              {depth > 0 ? '\u00A0\u00A0\u00A0\u00A0'.repeat(depth) : ''}{p.name}
            </option>
          ))}
        </select>

        <select
          value={priority}
          onChange={e => setPriority(e.target.value as any)}
          className={selectClass}
          style={{ color: priority === 'urgent' ? '#f87171' : priority === 'high' ? '#fb923c' : priority === 'medium' ? '#facc15' : '#7dd3fc' }}
        >
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <div
          className="relative bg-white/[0.06] border border-white/[0.08] rounded-lg px-2 py-1.5 cursor-pointer hover:border-white/[0.15] transition-colors"
          onClick={() => dateInputRef.current?.showPicker()}
        >
          <span className="text-xs text-white/60">{dueDate ? new Date(dueDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Date'}</span>
          <input
            ref={dateInputRef}
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          />
        </div>

        <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} className={selectClass}>
          {users.map(u => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>

        <button
          onClick={() => setShowMore(v => !v)}
          className="ml-auto flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors"
        >
          {showMore ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {showMore ? 'Less' : 'More options'}
        </button>
      </div>

      {/* Expanded "more" section */}
      {showMore && (
        <div className="px-3 py-2.5 border-t border-white/[0.06] space-y-3">
          {/* Description */}
          <div>
            <label className="block text-[10px] text-white/30 mb-1 uppercase tracking-wide">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Add more details…"
              rows={3}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-white/80 placeholder-white/25 focus:outline-none focus:border-brand-500/40 resize-y"
            />
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-white/30 mb-1 uppercase tracking-wide">Start time</label>
              <input
                type="time"
                value={dueTime}
                onChange={e => setDueTime(e.target.value)}
                className="w-full bg-white/[0.06] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-white/60 focus:outline-none focus:border-brand-500/40"
              />
            </div>
            <div>
              <label className="block text-[10px] text-white/30 mb-1 uppercase tracking-wide">End time</label>
              <input
                type="time"
                value={dueTimeEnd}
                onChange={e => setDueTimeEnd(e.target.value)}
                className="w-full bg-white/[0.06] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-white/60 focus:outline-none focus:border-brand-500/40"
              />
            </div>
          </div>

          {/* Reminder */}
          <div>
            <label className="block text-[10px] text-white/30 mb-1 uppercase tracking-wide">Reminder (minutes before)</label>
            <input
              type="number"
              min="0"
              value={reminderMinutes}
              onChange={e => setReminderMinutes(e.target.value)}
              placeholder="e.g. 15"
              className="w-full bg-white/[0.06] border border-white/[0.08] rounded-lg px-2 py-1.5 text-xs text-white/60 placeholder-white/25 focus:outline-none focus:border-brand-500/40"
            />
          </div>

          {/* Flags */}
          {currentUser.flags && currentUser.flags.length > 0 && (
            <div>
              <label className="block text-[10px] text-white/30 mb-1.5 uppercase tracking-wide">Flags</label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {currentUser.flags.map(f => {
                  const sel = selectedFlagIds.includes(f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setSelectedFlagIds(prev => sel ? prev.filter(id => id !== f.id) : [...prev, f.id])}
                      className="text-xs px-2.5 py-1 rounded-full border transition-colors"
                      style={sel
                        ? { backgroundColor: f.color + '22', borderColor: f.color + '66', color: f.color }
                        : { borderColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}
                    >
                      {f.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default InlineCapture;
