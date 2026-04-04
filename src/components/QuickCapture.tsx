import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, X, AlertCircle, Loader2 } from 'lucide-react';
import { useStore } from '../store';
import { format } from 'date-fns';
import { apiFetch } from '../lib/apiFetch';

interface ParsedTask {
  title: string;
  dueDate: string;
  dueTime: string;
  reminderAt: string;
  priority: string;
  assigneeIds: string[];
  projectIds: string[];
}

interface Props {
  initialText: string;
  onClose: () => void;
}

/** Pure: converts the confirmed ParsedTask form state into an addTask payload */
export function buildTaskPayload(parsed: ParsedTask) {
  return {
    title:            parsed.title,
    description:      undefined as undefined,
    projectIds:       parsed.projectIds,
    status:           'todo' as const,
    priority:         (parsed.priority || 'medium') as import('../types').Priority,
    assigneeIds:      parsed.assigneeIds,
    dueDate:          parsed.dueDate || undefined,
    dueTime:          parsed.dueTime || undefined,
    reminderAt:       parsed.reminderAt ? new Date(parsed.reminderAt).toISOString() : undefined,
    reminderSent:     false,
    isPrivate:        false,
    flags:            [] as import('../types').TaskFlag[],
    linkedContactIds: [] as string[],
    linkedDocIds:     [] as string[],
  };
}

const PRIORITIES = [
  { value: 'medium', label: 'Normal' },
  { value: 'high',   label: 'High' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'low',    label: 'Low' },
];

const selectCls = 'w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-white/70 focus:outline-none focus:border-violet-500/40 appearance-none cursor-pointer';
const inputCls  = 'w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-2.5 py-1.5 text-xs text-white/70 focus:outline-none focus:border-violet-500/40';
const labelCls  = 'block text-[10px] text-white/30 mb-1 uppercase tracking-wide';

export default function QuickCapture({ initialText, onClose }: Props) {
  const { projects, users, addTask } = useStore();
  const [input, setInput] = useState(initialText);
  const [parsed, setParsed] = useState<ParsedTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialText.trim().length > 0) parse(initialText);
    inputRef.current?.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape closes from anywhere — even when focused inside a dropdown or date field
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  async function parse(text: string) {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setParsed(null);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const resp = await apiFetch('/api/parse-task', {
        text,
        projects: projects.map((p) => ({ id: p.id, name: p.name })),
        users: users.map((u) => ({ id: u.id, name: u.name })),
        today,
      });
      const data = await resp.json();
      if (!resp.ok) { setError(data.error || 'Parse failed'); return; }
      setParsed({
        title:       data.title || text,
        dueDate:     data.dueDate || '',
        dueTime:     data.dueTime || '',
        reminderAt:  data.reminderAt ? data.reminderAt.slice(0, 16) : '',
        priority:    data.priority || 'medium',
        assigneeIds: Array.isArray(data.assigneeIds) ? data.assigneeIds : [],
        projectIds:  Array.isArray(data.projectIds)  ? data.projectIds  : [],
      });
    } catch {
      setError('Could not reach /api/parse-task. Is ANTHROPIC_API_KEY set in .env?');
    } finally {
      setLoading(false);
    }
  }

  function set<K extends keyof ParsedTask>(key: K, value: ParsedTask[K]) {
    setParsed((p) => p ? { ...p, [key]: value } : p);
  }

  function handleConfirm() {
    if (!parsed) return;
    addTask(buildTaskPayload(parsed));
    setCreated(true);
    setTimeout(onClose, 600);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'Enter' && !loading && input.trim() && !parsed) {
      e.preventDefault();
      parse(input);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed top-[14%] left-1/2 -translate-x-1/2 z-50 w-[560px] bg-[#18181b] border border-white/[0.10] rounded-2xl shadow-2xl overflow-hidden">

        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.06]">
          <Sparkles size={15} className="text-violet-400/70 flex-shrink-0" />
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); setParsed(null); setError(null); }}
            onKeyDown={handleKeyDown}
            placeholder="call Sarah Thursday at 4pm, remind me at 3:30…"
            className="flex-1 bg-transparent text-sm text-white placeholder-white/20 focus:outline-none"
          />
          {loading && <Loader2 size={14} className="text-white/30 animate-spin flex-shrink-0" />}
          <button onClick={onClose} className="text-white/20 hover:text-white/50 transition-colors flex-shrink-0">
            <X size={14} />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2.5 px-4 py-3 border-b border-white/[0.06]">
            <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-400/80">{error}</p>
          </div>
        )}

        {/* Editable fields */}
        {parsed && !loading && (
          <div className="px-4 pt-4 pb-3 space-y-3">

            {/* Title */}
            <div>
              <label className={labelCls}>Title</label>
              <input
                value={parsed.title}
                onChange={(e) => set('title', e.target.value)}
                className={inputCls + ' text-sm font-medium text-white/90'}
              />
            </div>

            {/* Row: date · time · priority */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className={labelCls}>Due date</label>
                <input
                  type="date"
                  value={parsed.dueDate}
                  onChange={(e) => set('dueDate', e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Due time</label>
                <input
                  type="time"
                  value={parsed.dueTime}
                  onChange={(e) => set('dueTime', e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Priority</label>
                <select
                  value={parsed.priority}
                  onChange={(e) => set('priority', e.target.value)}
                  className={selectCls}
                >
                  {PRIORITIES.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row: assignee · project */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelCls}>Assignee</label>
                <select
                  value={parsed.assigneeIds[0] || ''}
                  onChange={(e) => set('assigneeIds', e.target.value ? [e.target.value] : [])}
                  className={selectCls}
                >
                  <option value="">— none —</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Project</label>
                <select
                  value={parsed.projectIds[0] || ''}
                  onChange={(e) => set('projectIds', e.target.value ? [e.target.value] : [])}
                  className={selectCls}
                >
                  <option value="">— none —</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Reminder */}
            <div>
              <label className={labelCls}>Reminder (optional)</label>
              <input
                type="datetime-local"
                value={parsed.reminderAt}
                onChange={(e) => set('reminderAt', e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-white/[0.06] flex items-center justify-between">
          <div />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-white/30 hover:text-white/60 px-3 py-1.5 rounded-lg transition-colors"
            >
              Cancel
            </button>
            {!parsed && !loading && input.trim() && (
              <button
                onClick={() => parse(input)}
                className="text-xs text-violet-400/80 hover:text-violet-400 px-3 py-1.5 rounded-lg bg-violet-500/[0.08] hover:bg-violet-500/[0.14] transition-colors"
              >
                Parse
              </button>
            )}
            {parsed && (
              <button
                onClick={handleConfirm}
                disabled={created}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                  created
                    ? 'text-emerald-400 bg-emerald-500/[0.12]'
                    : 'text-white bg-violet-600/80 hover:bg-violet-600 active:scale-95'
                }`}
              >
                {created ? '✓ Created' : 'Create Task'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
