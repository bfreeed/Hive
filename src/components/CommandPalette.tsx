import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useStore } from '../store';
import { Home, CheckSquare, Users, Bell, Settings, FolderOpen, Search, MessageSquare, ArrowRight, Sparkles, Loader2, Calendar } from 'lucide-react';
import { DEFAULT_HOME_SECTIONS } from '../types';

interface Command {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  action: () => void;
  keywords?: string;
}

interface Props {
  onClose: () => void;
  onNavigate: (page: string, id?: string) => void;
  onOpenTask: (id: string) => void;
  onAICapture?: (text: string) => void;
}

// Words that signal a question/query rather than a navigation command
const QUESTION_SIGNALS = ['show', 'find', 'what', 'which', 'who', 'how', 'list', 'give', 'tell', 'search', 'any', 'all'];

function isAIQuery(query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/);
  if (words.length < 3) return false;
  return QUESTION_SIGNALS.some(w => words[0] === w || words[1] === w);
}

function isLayoutCommand(query: string): boolean {
  const q = query.toLowerCase();
  return (q.includes('hide') || q.includes('show') || q.includes('move') || q.includes('rearrange') || q.includes('order')) &&
    (q.includes('section') || q.includes('overdue') || q.includes('today') || q.includes('priority') || q.includes('meeting') || q.includes('home'));
}

export default function CommandPalette({ onClose, onNavigate, onOpenTask, onAICapture }: Props) {
  const { tasks, projects, meetings, userSettings, saveUserSettings } = useStore();
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const [aiMode, setAiMode] = useState(false);
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const staticCommands: Command[] = [
    { id: 'home',          label: 'Go to Home',          icon: <Home size={14} />,           action: () => { onNavigate('home'); onClose(); } },
    { id: 'tasks',         label: 'Go to My Tasks',      icon: <CheckSquare size={14} />,    action: () => { onNavigate('tasks'); onClose(); } },
    { id: 'meetings',      label: 'Go to Meetings',      icon: <Calendar size={14} />,       action: () => { onNavigate('meetings'); onClose(); } },
    { id: 'contacts',      label: 'Go to Contacts',      icon: <Users size={14} />,          action: () => { onNavigate('contacts'); onClose(); } },
    { id: 'messages',      label: 'Go to Messages',      icon: <MessageSquare size={14} />,  action: () => { onNavigate('messages'); onClose(); } },
    { id: 'notifications', label: 'Go to Notifications', icon: <Bell size={14} />,           action: () => { onNavigate('notifications'); onClose(); } },
    { id: 'settings',      label: 'Go to Settings',      icon: <Settings size={14} />,       action: () => { onNavigate('settings'); onClose(); } },
    ...projects.map(p => ({
      id: `project-${p.id}`,
      label: p.name, sublabel: 'Project',
      icon: <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />,
      action: () => { onNavigate('project', p.id); onClose(); },
      keywords: p.name.toLowerCase(),
    })),
    ...tasks.filter(t => t.status !== 'done').map(t => {
      const project = projects.find(p => p.id === t.projectIds?.[0]);
      return {
        id: `task-${t.id}`,
        label: t.title, sublabel: project?.name,
        icon: <ArrowRight size={14} className="text-white/30" />,
        action: () => { onOpenTask(t.id); onClose(); },
        keywords: t.title.toLowerCase(),
      };
    }),
  ];

  const isNaturalLanguage = query.trim().split(/\s+/).length >= 4;
  const showAIQuery = isAIQuery(query);
  const showLayoutCmd = isLayoutCommand(query);

  const filtered = useMemo(() => {
    const extras: Command[] = [];

    // AI task capture (4+ words)
    if (onAICapture && isNaturalLanguage && !showAIQuery && !showLayoutCmd) {
      extras.push({
        id: '__ai_capture__',
        label: `Create task: "${query.trim()}"`,
        sublabel: '✨ AI capture',
        icon: <Sparkles size={14} className="text-violet-400" />,
        action: () => { onAICapture(query.trim()); onClose(); },
      });
    }

    // AI query
    if (showAIQuery) {
      extras.push({
        id: '__ai_query__',
        label: `Ask AI: "${query.trim()}"`,
        sublabel: '✨ Search across everything',
        icon: <Sparkles size={14} className="text-brand-400" />,
        action: () => { setAiMode(true); handleAIQuery(query.trim()); },
      });
    }

    // Layout command
    if (showLayoutCmd) {
      extras.push({
        id: '__layout_cmd__',
        label: `Rearrange: "${query.trim()}"`,
        sublabel: '✨ Update Home layout',
        icon: <Sparkles size={14} className="text-emerald-400" />,
        action: () => { setAiMode(true); handleLayoutCommand(query.trim()); },
      });
    }

    if (!query.trim()) return staticCommands.slice(0, 8);
    const q = query.toLowerCase();
    const matches = staticCommands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.sublabel?.toLowerCase().includes(q) ||
      c.keywords?.includes(q)
    ).slice(0, 10 - extras.length);

    return [...extras, ...matches];
  }, [query, tasks, projects, isNaturalLanguage, showAIQuery, showLayoutCmd]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setActiveIdx(0); }, [filtered.length, query]);

  useEffect(() => {
    const el = listRef.current?.children[activeIdx] as HTMLElement;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const handleAIQuery = async (q: string) => {
    setAiLoading(true);
    setAiAnswer('');
    try {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const payload = {
        question: q,
        tasks: tasks.filter(t => t.status !== 'done').map(t => ({
          id: t.id, title: t.title, status: t.status, priority: t.priority,
          dueDate: t.dueDate, assigneeIds: t.assigneeIds,
          projectIds: t.projectIds, flags: t.flags,
        })),
        meetings: meetings.slice(0, 30).map(m => ({
          id: m.id, title: m.title, date: m.date,
          participants: m.participantNames,
          actionItems: m.actionItems,
        })),
        projects: projects.map(p => ({ id: p.id, name: p.name })),
        today: todayStr,
      };
      const res = await fetch('/api/hive-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { answer?: string; error?: string };
      setAiAnswer(data.answer ?? data.error ?? 'No response.');
    } catch {
      setAiAnswer('Could not reach the AI. Make sure the dev server is running.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleLayoutCommand = async (q: string) => {
    setAiLoading(true);
    setAiAnswer('');
    const currentSections = userSettings?.homeSections ?? DEFAULT_HOME_SECTIONS;
    try {
      const res = await fetch('/api/layout-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: q, sections: currentSections }),
      });
      const data = await res.json() as { sections?: typeof currentSections; message?: string; error?: string };
      if (data.sections) {
        await saveUserSettings({ homeSections: data.sections });
        setAiAnswer(data.message ?? 'Home layout updated.');
      } else {
        setAiAnswer(data.error ?? 'Could not update layout.');
      }
    } catch {
      setAiAnswer('Could not reach the AI.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (aiMode) {
      if (e.key === 'Escape') { e.preventDefault(); setAiMode(false); setAiAnswer(''); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); filtered[activeIdx]?.action(); }
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 z-50 w-[560px] bg-[#18181b] border border-white/[0.10] rounded-2xl shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.06]">
          {aiLoading ? (
            <Loader2 size={15} className="text-brand-400 flex-shrink-0 animate-spin" />
          ) : (
            <Search size={15} className="text-white/30 flex-shrink-0" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); if (aiMode) { setAiMode(false); setAiAnswer(''); } }}
            onKeyDown={handleKeyDown}
            placeholder={aiMode ? 'Ask anything…' : 'Search, navigate, or ask anything…'}
            className="flex-1 bg-transparent text-sm text-white placeholder-white/25 focus:outline-none"
          />
          <kbd className="text-[10px] text-white/20 bg-white/[0.06] px-1.5 py-0.5 rounded font-mono">ESC</kbd>
        </div>

        {/* AI answer */}
        {aiMode && (
          <div className="px-4 py-4 max-h-72 overflow-y-auto scrollbar-hide">
            {aiLoading ? (
              <p className="text-sm text-white/40">Thinking…</p>
            ) : (
              <pre className="whitespace-pre-wrap text-sm text-white/80 font-sans leading-relaxed">{aiAnswer}</pre>
            )}
            {!aiLoading && (
              <button
                onClick={() => { setAiMode(false); setAiAnswer(''); setQuery(''); }}
                className="mt-4 text-xs text-white/30 hover:text-white/50 transition-colors"
              >
                Back to search
              </button>
            )}
          </div>
        )}

        {/* Results */}
        {!aiMode && (
          <div ref={listRef} className="max-h-80 overflow-y-auto scrollbar-hide py-1.5">
            {filtered.length === 0 ? (
              <p className="text-white/20 text-sm text-center py-8">No results</p>
            ) : (
              filtered.map((cmd, i) => (
                <button
                  key={cmd.id}
                  onClick={cmd.action}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    cmd.id.startsWith('__')
                      ? i === activeIdx ? 'bg-brand-500/[0.12]' : 'hover:bg-brand-500/[0.07]'
                      : i === activeIdx ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="flex-shrink-0 flex items-center">{cmd.icon}</span>
                  <span className={`flex-1 text-sm truncate ${cmd.id.startsWith('__') ? 'text-brand-200/80' : 'text-white/80'}`}>
                    {cmd.label}
                  </span>
                  {cmd.sublabel && !cmd.id.startsWith('__') && (
                    <span className="text-xs text-white/25 flex-shrink-0">{cmd.sublabel}</span>
                  )}
                  {cmd.sublabel && cmd.id.startsWith('__') && (
                    <span className="text-xs text-brand-400/60 flex-shrink-0">{cmd.sublabel}</span>
                  )}
                  {i === activeIdx && (
                    <kbd className="text-[10px] text-white/20 bg-white/[0.06] px-1.5 py-0.5 rounded font-mono flex-shrink-0">↵</kbd>
                  )}
                </button>
              ))
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-2 border-t border-white/[0.06] flex items-center gap-4">
          <span className="text-[10px] text-white/20 flex items-center gap-1"><kbd className="bg-white/[0.06] px-1 rounded font-mono">↑↓</kbd> navigate</span>
          <span className="text-[10px] text-white/20 flex items-center gap-1"><kbd className="bg-white/[0.06] px-1 rounded font-mono">↵</kbd> open</span>
          <span className="text-[10px] text-white/20 flex items-center gap-1"><Sparkles size={9} className="text-brand-400" /> ask anything</span>
          <span className="text-[10px] text-white/20 flex items-center gap-1"><kbd className="bg-white/[0.06] px-1 rounded font-mono">esc</kbd> close</span>
        </div>
      </div>
    </>
  );
}
