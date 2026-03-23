import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';
import { AlertTriangle, Clock, MessageSquare, CheckCircle, ArrowRight, Plus, X, Sun } from 'lucide-react';
import { isPast } from 'date-fns';
import TaskRow from '../components/TaskRow';

function Section({ title, icon, tasks, onOpenTask, color = 'text-white/50' }: {
  title: string; icon: React.ReactNode; tasks: import('../types').Task[];
  onOpenTask: (id: string) => void; color?: string;
}) {
  if (tasks.length === 0) return null;
  return (
    <div className="mb-6">
      <div className={`flex items-center gap-2 mb-2 ${color}`}>
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
        <span className="text-xs opacity-50 ml-1">{tasks.length}</span>
      </div>
      <div className="space-y-0.5">
        {tasks.map((t) => <TaskRow key={t.id} task={t} onOpenTask={onOpenTask} showProject />)}
      </div>
    </div>
  );
}

export default function Home({ onNavigate, onOpenTask }: { onNavigate: (page: string, id?: string) => void; onOpenTask: (id: string) => void }) {
  const { tasks, projects, addTask } = useStore();
  const [showCapture, setShowCapture] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Cancel speech if user navigates away from Home
  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);

  const triggerBriefing = useCallback(async () => {
    const now2 = new Date();
    const h = now2.getHours();
    const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    // Use local date (not UTC) to match how task due dates are stored
    const todayStr = `${now2.getFullYear()}-${String(now2.getMonth() + 1).padStart(2, '0')}-${String(now2.getDate()).padStart(2, '0')}`;

    const overdueTasks = tasks.filter(t => t.status !== 'done' && t.dueDate && t.dueDate < todayStr);
    const dueTodayCount = tasks.filter(t => t.status !== 'done' && t.dueDate === todayStr).length;
    const urgentTasks = tasks.filter(t =>
      t.status !== 'done' && (t.priority === 'urgent' || t.priority === 'high') &&
      !(t.dueDate && t.dueDate < todayStr)
    );
    const sarahTasks = tasks.filter(t => t.status !== 'done' && t.flags?.some(f => f.flagId === 'flag-checkin'));

    // Build natural-language speech
    const sentences: string[] = [];
    sentences.push(`${greet}, Lev.`);

    if (overdueTasks.length > 0) {
      sentences.push(`You have ${overdueTasks.length} overdue task${overdueTasks.length !== 1 ? 's' : ''}: ${overdueTasks.map(t => t.title).join(', ')}.`);
    }
    if (dueTodayCount > 0) {
      sentences.push(`${dueTodayCount} task${dueTodayCount !== 1 ? 's are' : ' is'} due today.`);
    }
    if (urgentTasks.length > 0) {
      sentences.push(`Urgent items: ${urgentTasks.map(t => t.title).join(', ')}.`);
    }
    if (sarahTasks.length > 0) {
      sentences.push(`Sarah needs you on: ${sarahTasks.map(t => t.title).join(', ')}.`);
    }
    if (overdueTasks.length === 0 && dueTodayCount === 0 && urgentTasks.length === 0 && sarahTasks.length === 0) {
      sentences.push('All clear — nothing urgent today.');
    }
    const speechText = sentences.join(' ');

    // Speak it
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(speechText);
      utterance.rate = 0.92;
      utterance.pitch = 1;
      setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }

  }, [tasks]);
  const [captureTitle, setCaptureTitle] = useState('');
  const [captureProject, setCaptureProject] = useState('');
  const captureRef = useRef<HTMLInputElement>(null);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  // N key shortcut to open capture
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'n' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setShowCapture(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (showCapture) captureRef.current?.focus();
  }, [showCapture]);

  const handleCapture = () => {
    if (!captureTitle.trim()) return;
    const selectedProject = projects.find(p => p.id === captureProject);
    addTask({
      title: captureTitle.trim(),
      projectIds: captureProject ? [captureProject] : [],
      status: 'todo',
      priority: 'medium',
      assigneeIds: ['lev'],
      flags: [],
      isPrivate: selectedProject?.isPrivate ?? false,
      linkedContactIds: [],
      linkedDocIds: [],
    });
    setCaptureTitle('');
    setShowCapture(false);
  };

  // Filter out snoozed tasks
  const activeTasks = tasks.filter((t) => {
    if (t.status === 'done') return false;
    if (t.snoozeDate && new Date(t.snoozeDate) > new Date()) return false;
    return true;
  });

  const within72 = activeTasks.filter((t) => t.flags?.some(f => f.flagId === 'flag-72h'));
  const questionsForLev = activeTasks.filter((t) => t.flags?.some(f => f.flagId === 'flag-questions'));
  const updateAtCheckin = activeTasks.filter((t) => t.flags?.some(f => f.flagId === 'flag-checkin'));
  const overdue = activeTasks.filter((t) => t.dueDate && isPast(new Date(t.dueDate)) && !within72.includes(t));
  const todayTasks = activeTasks.filter((t) => {
    if (!t.dueDate || within72.includes(t) || overdue.includes(t)) return false;
    const d = new Date(t.dueDate);
    return d.toDateString() === new Date().toDateString();
  });
  const highPriority = activeTasks.filter((t) =>
    (t.priority === 'urgent' || t.priority === 'high') &&
    !within72.includes(t) && !overdue.includes(t) && !todayTasks.includes(t)
  );

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide">
      <div className="max-w-3xl mx-auto px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <p className="text-white/30 text-sm mb-1">{today}</p>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-semibold text-white tracking-tight">{greeting}, Lev.</h1>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCapture(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/[0.06] text-white/50 hover:bg-white/[0.10] hover:text-white/80 transition-all"
              >
                <Plus size={13} /> New Task
              </button>
              <button
                onClick={triggerBriefing}
                disabled={isSpeaking}
                title="Read morning briefing aloud"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isSpeaking ? 'bg-amber-500/30 text-amber-300 ring-1 ring-amber-400/40 animate-pulse' : 'bg-amber-500/10 text-amber-400/70 hover:bg-amber-500/20 hover:text-amber-400'}`}
              >
                <Sun size={13} />
                {isSpeaking ? 'Speaking…' : 'Briefing'}
              </button>
            </div>
          </div>
          <p className="text-white/40 mt-1 text-sm">
            {activeTasks.length} active tasks across {new Set(activeTasks.flatMap((t) => t.projectIds ?? [])).size} projects
          </p>
        </div>

        {/* Quick capture */}
        {showCapture ? (
          <div className="mb-6 flex items-center gap-2 p-3 bg-white/[0.04] rounded-xl border border-brand-500/30">
            <input
              ref={captureRef}
              value={captureTitle}
              onChange={(e) => setCaptureTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCapture();
                if (e.key === 'Escape') { setShowCapture(false); setCaptureTitle(''); }
              }}
              placeholder="What needs to be done?"
              className="flex-1 bg-transparent text-sm text-white placeholder-white/20 focus:outline-none"
            />
            <select
              value={captureProject}
              onChange={(e) => setCaptureProject(e.target.value)}
              className="text-xs bg-white/[0.06] border border-white/[0.08] rounded-lg px-2 py-1.5 text-white/60 focus:outline-none"
            >
              <option value="">No project</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <button onClick={handleCapture} className="px-3 py-1.5 bg-brand-600 text-white text-xs rounded-lg hover:bg-brand-500 transition-colors">Add</button>
            <button onClick={() => { setShowCapture(false); setCaptureTitle(''); }} className="p-1.5 text-white/30 hover:text-white/60 transition-colors">
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowCapture(true)}
            className="mb-6 w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-white/[0.08] hover:border-white/20 text-white/20 hover:text-white/40 text-sm transition-colors"
          >
            <Plus size={14} /> Quick capture… <span className="ml-auto text-xs font-mono bg-white/[0.06] px-1.5 py-0.5 rounded">N</span>
          </button>
        )}

        {/* Sections */}
        <Section title="Within 72 Hours" icon={<AlertTriangle size={13} />} tasks={within72} onOpenTask={onOpenTask} color="text-red-400" />
        <Section title="Due Today" icon={<Clock size={13} />} tasks={todayTasks} onOpenTask={onOpenTask} color="text-orange-400" />
        <Section title="Overdue" icon={<AlertTriangle size={13} />} tasks={overdue} onOpenTask={onOpenTask} color="text-red-500" />
        <Section title="Questions for Lev" icon={<MessageSquare size={13} />} tasks={questionsForLev} onOpenTask={onOpenTask} color="text-purple-400" />
        <Section title="Sarah's Updates" icon={<CheckCircle size={13} />} tasks={updateAtCheckin} onOpenTask={onOpenTask} color="text-emerald-400" />
        <Section title="High Priority" icon={<ArrowRight size={13} />} tasks={highPriority} onOpenTask={onOpenTask} color="text-white/40" />

        {within72.length === 0 && overdue.length === 0 && todayTasks.length === 0 && questionsForLev.length === 0 && highPriority.length === 0 && !showCapture && (
          <div className="text-center py-16">
            <p className="text-white/20 text-lg">All clear.</p>
            <p className="text-white/10 text-sm mt-1">Nothing urgent today.</p>
          </div>
        )}
      </div>
    </div>
  );
}
