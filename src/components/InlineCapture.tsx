import React, { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Plus, X } from 'lucide-react';
import { useStore } from '../store';
import { flattenProjects } from '../lib/projectUtils';

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
  const { initialTitle, initialProjectId, initialAssigneeId, onCreated, onCancel, onOpenDetail, showCollapsedButton = true } = props;
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
  const inputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (show) inputRef.current?.focus(); }, [show]);

  const buildTask = () => {
    const selectedProject = projects.find(p => p.id === project);
    return {
      title: title.trim() || 'New task',
      projectIds: project ? [project] : [],
      status: 'todo' as const,
      priority,
      assigneeIds: [assigneeId],
      dueDate: dueDate || undefined,
      flags: [], isPrivate: selectedProject?.isPrivate ?? false,
      linkedContactIds: [], linkedDocIds: [],
    };
  };

  const handleCapture = () => {
    if (!title.trim()) return;
    addTask(buildTask());
    onCreated?.();
    resetFields();
  };

  const handleOpenDetail = async () => {
    const taskData = buildTask();
    await addTask(taskData);
    // Find the task we just created by title (most recent match)
    const all = useStore.getState().tasks;
    const created = [...all].reverse().find(t => t.title === taskData.title);
    resetFields();
    if (created) onOpenDetail?.(created.id);
  };

  const resetFields = () => {
    setShow(false);
    setTitle(initialTitle ?? '');
    setProject(initialProjectId ?? '');
    setPriority('medium');
    setDueDate('');
    setAssigneeId(initialAssigneeId ?? currentUser.id);
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
        className="mb-6 w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-white/40 hover:border-white/55 text-white/40 hover:text-white/60 text-sm transition-colors"
      >
        <Plus size={14} /> Quick capture… <span className="ml-auto text-xs font-mono bg-white/[0.06] px-1.5 py-0.5 rounded">N</span>
      </button>
    );
  }

  const selectClass = 'text-xs bg-white/[0.06] border border-white/[0.08] rounded-lg px-2 py-1.5 text-white/60 focus:outline-none';

  return (
    <div ref={containerRef} className="mb-6 bg-white/[0.04] rounded-xl border border-brand-500/30 overflow-hidden">
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

        {onOpenDetail && (
          <button
            onClick={handleOpenDetail}
            className="ml-auto text-xs text-white/30 hover:text-white/60 transition-colors underline underline-offset-2"
          >
            See detailed view
          </button>
        )}
      </div>
    </div>
  );
});

export default InlineCapture;
