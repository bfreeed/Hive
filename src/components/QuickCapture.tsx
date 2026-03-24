import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, X, Calendar, Clock, User, FolderOpen, AlertCircle, Loader2 } from 'lucide-react';
import { useStore } from '../store';
import { format, parseISO } from 'date-fns';

interface ParsedTask {
  title: string;
  dueDate?: string | null;
  dueTime?: string | null;
  reminderAt?: string | null;
  priority?: string | null;
  assigneeIds?: string[];
  projectIds?: string[];
}

interface Props {
  initialText: string;
  onClose: () => void;
}

export default function QuickCapture({ initialText, onClose }: Props) {
  const { projects, users, addTask } = useStore();
  const [input, setInput] = useState(initialText);
  const [parsed, setParsed] = useState<ParsedTask | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-parse on open if there's initial text
  useEffect(() => {
    if (initialText.trim().length > 0) {
      parse(initialText);
    }
    inputRef.current?.focus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function parse(text: string) {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setParsed(null);
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const resp = await fetch('/api/parse-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          projects: projects.map((p) => ({ id: p.id, name: p.name })),
          users: users.map((u) => ({ id: u.id, name: u.name })),
          today,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.error || 'Parse failed');
        return;
      }
      setParsed({
        title: data.title || text,
        dueDate: data.dueDate || null,
        dueTime: data.dueTime || null,
        reminderAt: data.reminderAt || null,
        priority: data.priority || null,
        assigneeIds: Array.isArray(data.assigneeIds) ? data.assigneeIds : [],
        projectIds: Array.isArray(data.projectIds) ? data.projectIds : [],
      });
    } catch (e) {
      setError('Could not reach /api/parse-task. Is ANTHROPIC_API_KEY set in .env?');
    } finally {
      setLoading(false);
    }
  }

  function handleConfirm() {
    if (!parsed) return;
    addTask({
      title: parsed.title,
      description: undefined,
      projectIds: parsed.projectIds || [],
      status: 'todo',
      priority: (parsed.priority as any) || 'normal',
      assigneeIds: parsed.assigneeIds || [],
      dueDate: parsed.dueDate || undefined,
      dueTime: parsed.dueTime || undefined,
      reminderAt: parsed.reminderAt || undefined,
      reminderSent: false,
      isPrivate: false,
      flags: [],
      linkedContactIds: [],
      linkedDocIds: [],
    });
    setCreated(true);
    setTimeout(() => {
      onClose();
    }, 600);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'Enter' && !loading && input.trim()) {
      e.preventDefault();
      if (parsed) {
        handleConfirm();
      } else {
        parse(input);
      }
    }
  }

  const assigneeNames = (parsed?.assigneeIds || [])
    .map((id) => users.find((u) => u.id === id)?.name)
    .filter(Boolean);

  const projectNames = (parsed?.projectIds || [])
    .map((id) => projects.find((p) => p.id === id)?.name)
    .filter(Boolean);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed top-[18%] left-1/2 -translate-x-1/2 z-50 w-[580px] bg-[#18181b] border border-white/[0.10] rounded-2xl shadow-2xl overflow-hidden">

        {/* Input row */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.06]">
          <Sparkles size={15} className="text-violet-400/70 flex-shrink-0" />
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); setParsed(null); setError(null); }}
            onKeyDown={handleKeyDown}
            placeholder="follow up with Mike about roof next Tuesday 3pm…"
            className="flex-1 bg-transparent text-sm text-white placeholder-white/20 focus:outline-none"
          />
          {loading && <Loader2 size={14} className="text-white/30 animate-spin flex-shrink-0" />}
          <button onClick={onClose} className="text-white/20 hover:text-white/50 transition-colors flex-shrink-0">
            <X size={14} />
          </button>
        </div>

        {/* Error state */}
        {error && (
          <div className="flex items-start gap-2.5 px-4 py-3 border-b border-white/[0.06]">
            <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-400/80">{error}</p>
          </div>
        )}

        {/* Parsed confirmation */}
        {parsed && !loading && (
          <div className="px-4 py-3.5 space-y-3">
            {/* Title — editable */}
            <input
              value={parsed.title}
              onChange={(e) => setParsed({ ...parsed, title: e.target.value })}
              className="w-full bg-transparent text-sm font-medium text-white/90 focus:outline-none border-b border-white/[0.08] pb-1 focus:border-violet-500/40 transition-colors"
            />

            {/* Parsed metadata chips */}
            <div className="flex flex-wrap gap-2">
              {parsed.dueDate && (
                <span className="flex items-center gap-1 text-[11px] text-white/50 bg-white/[0.05] px-2 py-1 rounded-md">
                  <Calendar size={10} className="text-white/30" />
                  {format(parseISO(parsed.dueDate), 'MMM d')}
                  {parsed.dueTime && ` · ${parsed.dueTime}`}
                </span>
              )}
              {parsed.reminderAt && (
                <span className="flex items-center gap-1 text-[11px] text-violet-400/70 bg-violet-500/[0.08] px-2 py-1 rounded-md">
                  <Clock size={10} />
                  Reminder {format(parseISO(parsed.reminderAt), 'MMM d, h:mm a')}
                </span>
              )}
              {assigneeNames.map((name) => (
                <span key={name} className="flex items-center gap-1 text-[11px] text-white/50 bg-white/[0.05] px-2 py-1 rounded-md">
                  <User size={10} className="text-white/30" />
                  {name}
                </span>
              ))}
              {projectNames.map((name) => (
                <span key={name} className="flex items-center gap-1 text-[11px] text-white/50 bg-white/[0.05] px-2 py-1 rounded-md">
                  <FolderOpen size={10} className="text-white/30" />
                  {name}
                </span>
              ))}
              {parsed.priority && parsed.priority !== 'normal' && (
                <span className={`text-[11px] px-2 py-1 rounded-md ${
                  parsed.priority === 'urgent' ? 'text-red-400/80 bg-red-500/[0.08]' :
                  parsed.priority === 'high' ? 'text-orange-400/80 bg-orange-500/[0.08]' :
                  'text-white/40 bg-white/[0.05]'
                }`}>
                  {parsed.priority}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-[10px] text-white/20 flex items-center gap-1">
              <kbd className="bg-white/[0.06] px-1 rounded font-mono">↵</kbd>
              {parsed ? 'create task' : 'parse'}
            </span>
            <span className="text-[10px] text-white/20 flex items-center gap-1">
              <kbd className="bg-white/[0.06] px-1 rounded font-mono">esc</kbd>
              cancel
            </span>
          </div>

          <div className="flex items-center gap-2">
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
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
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
