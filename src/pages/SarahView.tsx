import React from 'react';
import { useStore } from '../store';
import { format, isPast } from 'date-fns';
import type { Task } from '../types';

function TaskRow({ task, onOpenTask }: { task: Task; onOpenTask: (id: string) => void }) {
  const { projects } = useStore();
  const project = projects.find((p) => p.id === task.projectIds?.[0]);
  const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && task.status !== 'done';

  return (
    <div onClick={() => onOpenTask(task.id)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.04] cursor-pointer group transition-colors">
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${task.status === 'done' ? 'bg-emerald-500' : task.status === 'doing' ? 'bg-brand-400' : task.status === 'waiting' ? 'bg-yellow-400' : 'bg-white/20'}`} />
      <span className={`flex-1 text-sm truncate ${task.status === 'done' ? 'line-through text-white/30' : 'text-white/70 group-hover:text-white'}`}>{task.title}</span>
      {project && <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: project.color + 'cc' }}>{project.name}</span>}
      {task.dueDate && <span className={`text-xs flex-shrink-0 ${isOverdue ? 'text-red-400' : 'text-white/30'}`}>{format(new Date(task.dueDate), 'MMM d')}</span>}
    </div>
  );
}

function Section({ title, tasks, color, onOpenTask }: { title: string; tasks: Task[]; color: string; onOpenTask: (id: string) => void }) {
  return (
    <div className="mb-8">
      <div className={`flex items-center gap-2 mb-3 ${color}`}>
        <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
        <span className="text-xs opacity-50">{tasks.length}</span>
      </div>
      {tasks.length === 0
        ? <p className="text-sm text-white/20 px-3">None</p>
        : <div className="space-y-0.5">{tasks.map((t) => <TaskRow key={t.id} task={t} onOpenTask={onOpenTask} />)}</div>
      }
    </div>
  );
}

export default function SarahView({ onOpenTask }: { onOpenTask: (id: string) => void }) {
  const { tasks, projects } = useStore();

  const sarahTasks = tasks.filter((t) => {
    if (!t.assigneeIds.includes('sarah')) return false;
    if (t.isPrivate) return false;
    const isInPrivateProject = (t.projectIds ?? []).some(pid => projects.find(p => p.id === pid)?.isPrivate);
    if (isInPrivateProject) return false;
    return true;
  });
  const active = sarahTasks.filter((t) => t.status !== 'done' && t.status !== 'review');
  const review = sarahTasks.filter((t) => t.status === 'review');
  const waiting = sarahTasks.filter((t) => t.status === 'waiting');
  const recent = sarahTasks.filter((t) => t.status === 'done').slice(0, 5);

  return (
    <div className="flex-1 overflow-y-auto scrollbar-hide">
      <div className="max-w-3xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-xl font-semibold text-emerald-400">S</div>
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">Sarah's View</h1>
            <p className="text-white/40 text-sm">{active.length} active · {waiting.length} waiting · {review.length} in review</p>
          </div>
        </div>

        <Section title="Active" tasks={active} color="text-white/50" onOpenTask={onOpenTask} />
        <Section title="In Review — Needs Your Sign-off" tasks={review} color="text-purple-400" onOpenTask={onOpenTask} />
        <Section title="Waiting On" tasks={waiting} color="text-yellow-400" onOpenTask={onOpenTask} />
        <Section title="Recently Completed" tasks={recent} color="text-emerald-400" onOpenTask={onOpenTask} />
      </div>
    </div>
  );
}
