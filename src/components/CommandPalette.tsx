import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useStore } from '../store';
import { Home, CheckSquare, Users, Bell, Settings, FolderOpen, Search, MessageSquare, ArrowRight, Sparkles } from 'lucide-react';

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

export default function CommandPalette({ onClose, onNavigate, onOpenTask, onAICapture }: Props) {
  const { tasks, projects } = useStore();
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const staticCommands: Command[] = [
    { id: 'home',          label: 'Go to Home',          icon: <Home size={14} />,        action: () => { onNavigate('home'); onClose(); } },
    { id: 'tasks',         label: 'Go to My Tasks',      icon: <CheckSquare size={14} />, action: () => { onNavigate('tasks'); onClose(); } },
    { id: 'contacts',      label: 'Go to Contacts',      icon: <Users size={14} />,       action: () => { onNavigate('contacts'); onClose(); } },
    { id: 'messages',      label: 'Go to Messages',      icon: <MessageSquare size={14} />, action: () => { onNavigate('messages'); onClose(); } },
    { id: 'notifications', label: 'Go to Notifications', icon: <Bell size={14} />,        action: () => { onNavigate('notifications'); onClose(); } },
    { id: 'settings',      label: 'Go to Settings',      icon: <Settings size={14} />,    action: () => { onNavigate('settings'); onClose(); } },
    ...projects.map((p) => ({
      id: `project-${p.id}`,
      label: p.name,
      sublabel: 'Project',
      icon: <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />,
      action: () => { onNavigate('project', p.id); onClose(); },
      keywords: p.name.toLowerCase(),
    })),
    ...tasks.filter(t => t.status !== 'done').map((t) => {
      const project = projects.find(p => p.id === t.projectIds?.[0]);
      return {
        id: `task-${t.id}`,
        label: t.title,
        sublabel: project?.name,
        icon: <ArrowRight size={14} className="text-white/30" />,
        action: () => { onOpenTask(t.id); onClose(); },
        keywords: t.title.toLowerCase(),
      };
    }),
  ];

  // Show AI capture option when query looks like natural language (4+ words)
  const isNaturalLanguage = query.trim().split(/\s+/).length >= 4;

  const filtered = useMemo(() => {
    const aiOption: Command | null = (onAICapture && isNaturalLanguage)
      ? {
          id: '__ai_capture__',
          label: `Create with AI: "${query.trim()}"`,
          sublabel: '✨ Quick capture',
          icon: <Sparkles size={14} className="text-violet-400" />,
          action: () => { onAICapture(query.trim()); onClose(); },
        }
      : null;

    if (!query.trim()) return staticCommands.slice(0, 8);
    const q = query.toLowerCase();
    const matches = staticCommands.filter((c) =>
      c.label.toLowerCase().includes(q) ||
      (c.sublabel?.toLowerCase().includes(q)) ||
      (c.keywords?.includes(q))
    ).slice(0, aiOption ? 9 : 10);

    return aiOption ? [aiOption, ...matches] : matches;
  }, [query, tasks, projects, isNaturalLanguage, onAICapture]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset active index when results change
  useEffect(() => { setActiveIdx(0); }, [filtered.length, query]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIdx] as HTMLElement;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); filtered[activeIdx]?.action(); }
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed top-[20%] left-1/2 -translate-x-1/2 z-50 w-[560px] bg-[#18181b] border border-white/[0.10] rounded-2xl shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.06]">
          <Search size={15} className="text-white/30 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search tasks, projects, pages…"
            className="flex-1 bg-transparent text-sm text-white placeholder-white/25 focus:outline-none"
          />
          <kbd className="text-[10px] text-white/20 bg-white/[0.06] px-1.5 py-0.5 rounded font-mono">ESC</kbd>
        </div>

        {/* Results */}
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
                  cmd.id === '__ai_capture__'
                    ? i === activeIdx ? 'bg-violet-500/[0.12]' : 'hover:bg-violet-500/[0.07]'
                    : i === activeIdx ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'
                }`}
              >
                <span className="flex-shrink-0 flex items-center">{cmd.icon}</span>
                <span className={`flex-1 text-sm truncate ${cmd.id === '__ai_capture__' ? 'text-violet-200/80' : 'text-white/80'}`}>
                  {cmd.label}
                </span>
                {cmd.sublabel && cmd.id !== '__ai_capture__' && (
                  <span className="text-xs text-white/25 flex-shrink-0">{cmd.sublabel}</span>
                )}
                {i === activeIdx && (
                  <kbd className="text-[10px] text-white/20 bg-white/[0.06] px-1.5 py-0.5 rounded font-mono flex-shrink-0">↵</kbd>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-white/[0.06] flex items-center gap-4">
          <span className="text-[10px] text-white/20 flex items-center gap-1"><kbd className="bg-white/[0.06] px-1 rounded font-mono">↑↓</kbd> navigate</span>
          <span className="text-[10px] text-white/20 flex items-center gap-1"><kbd className="bg-white/[0.06] px-1 rounded font-mono">↵</kbd> open</span>
          <span className="text-[10px] text-white/20 flex items-center gap-1"><kbd className="bg-white/[0.06] px-1 rounded font-mono">esc</kbd> close</span>
        </div>
      </div>
    </>
  );
}
