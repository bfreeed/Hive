import React, { useState } from 'react';
import { useStore } from '../store';
import { CalendarDays, AlertTriangle, CheckCircle2, Clock, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react';
import TaskRow from '../components/TaskRow';
import { format } from 'date-fns';

interface TodayPageProps {
  onOpenTask: (id: string) => void;
}

export default function TodayPage({ onOpenTask }: TodayPageProps) {
  const { tasks, projects, updateTask } = useStore();
  const [overdueOpen, setOverdueOpen] = useState(true);
  const [todayOpen, setTodayOpen] = useState(true);
  const [completedOpen, setCompletedOpen] = useState(true);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayLabel = format(new Date(), 'EEEE, MMMM d');

  // Only top-level tasks (no subtasks)
  const topLevel = tasks.filter(t => !t.parentId);

  const overdue = topLevel.filter(t =>
    t.status !== 'done' && t.dueDate && t.dueDate < todayStr
  ).sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));

  const dueToday = topLevel.filter(t =>
    t.status !== 'done' && t.dueDate === todayStr
  );

  const completedToday = topLevel.filter(t =>
    t.status === 'done' && t.completedAt && t.completedAt.slice(0, 10) === todayStr
  ).sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''));

  const getProjectColor = (task: typeof tasks[0]) => {
    const proj = projects.find(p => p.id === task.projectIds?.[0]);
    return proj?.color;
  };

  const SectionHeader = ({
    icon, label, count, open, onToggle, accent
  }: {
    icon: React.ReactNode; label: string; count: number; open: boolean;
    onToggle: () => void; accent: string;
  }) => (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-1 py-2 text-left group"
    >
      {open ? <ChevronDown size={14} className="text-white/30" /> : <ChevronRight size={14} className="text-white/30" />}
      <span className={`flex items-center gap-1.5 text-sm font-semibold ${accent}`}>
        {icon}
        {label}
      </span>
      <span className="text-xs text-white/30 ml-1">{count}</span>
    </button>
  );

  const empty = overdue.length === 0 && dueToday.length === 0 && completedToday.length === 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 h-14 border-b border-white/[0.06] flex-shrink-0">
        <CalendarDays size={18} className="text-brand-400" />
        <div>
          <h1 className="text-base font-semibold text-white">Today</h1>
          <p className="text-xs text-white/30">{todayLabel}</p>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-white/30">
          {overdue.length > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">
              <AlertTriangle size={10} />
              {overdue.length} overdue
            </span>
          )}
          {dueToday.length > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400">
              <Clock size={10} />
              {dueToday.length} due today
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">

          {empty && (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                <CheckCircle2 size={28} className="text-emerald-400" />
              </div>
              <p className="text-white/60 font-medium text-sm">All clear</p>
              <p className="text-white/30 text-sm mt-1">No tasks due today or overdue.</p>
            </div>
          )}

          {/* Overdue */}
          {overdue.length > 0 && (
            <div>
              <SectionHeader
                icon={<AlertTriangle size={14} />}
                label="Overdue"
                count={overdue.length}
                open={overdueOpen}
                onToggle={() => setOverdueOpen(v => !v)}
                accent="text-red-400"
              />
              {overdueOpen && (
                <div className="mt-1 rounded-xl border border-white/[0.06] overflow-hidden divide-y divide-white/[0.04]">
                  {overdue.map(task => (
                    <div key={task.id} className="relative">
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-500/40" />
                      <TaskRow task={task} onOpenTask={onOpenTask} showProject />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Due Today */}
          {dueToday.length > 0 && (
            <div>
              <SectionHeader
                icon={<Clock size={14} />}
                label="Due Today"
                count={dueToday.length}
                open={todayOpen}
                onToggle={() => setTodayOpen(v => !v)}
                accent="text-brand-400"
              />
              {todayOpen && (
                <div className="mt-1 rounded-xl border border-white/[0.06] overflow-hidden divide-y divide-white/[0.04]">
                  {dueToday.map(task => (
                    <div key={task.id} className="relative">
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-brand-500/50" />
                      <TaskRow task={task} onOpenTask={onOpenTask} showProject />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Completed today */}
          {completedToday.length > 0 && (
            <div>
              <SectionHeader
                icon={<CheckCircle2 size={14} />}
                label="Completed Today"
                count={completedToday.length}
                open={completedOpen}
                onToggle={() => setCompletedOpen(v => !v)}
                accent="text-emerald-400"
              />
              {completedOpen && (
                <div className="mt-1 rounded-xl border border-white/[0.06] overflow-hidden divide-y divide-white/[0.04]">
                  {completedToday.map(task => (
                    <div key={task.id} className="flex items-center group">
                      <div className="flex-1 min-w-0">
                        <TaskRow task={task} onOpenTask={onOpenTask} showProject />
                      </div>
                      <button
                        onClick={() => updateTask(task.id, { status: 'todo', completedAt: undefined })}
                        title="Reopen"
                        className="flex-shrink-0 mr-3 p-1.5 rounded-md text-white/20 hover:text-white/60 hover:bg-white/[0.06] opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <RotateCcw size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
