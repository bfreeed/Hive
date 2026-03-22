import React from 'react';
import { useStore } from '../store';
import { AlertTriangle } from 'lucide-react';
import { format, isPast, isToday, isTomorrow } from 'date-fns';
import type { Task } from '../types';

const PRIORITY_DOT: Record<string, string> = {
  urgent: 'bg-red-400',
  high: 'bg-orange-400',
  medium: 'bg-yellow-400',
  low: 'bg-white/20',
};

interface TaskRowProps {
  task: Task;
  onOpenTask: (id: string) => void;
  showProject?: boolean;
}

export default function TaskRow({ task, onOpenTask, showProject = false }: TaskRowProps) {
  const { projects, updateTask } = useStore();
  const project = projects.find((p) => p.id === task.projectIds?.[0]);
  const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && task.status !== 'done';

  return (
    <div
      className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-white/[0.04] cursor-pointer group transition-colors"
      onClick={() => onOpenTask(task.id)}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          updateTask(task.id, { status: task.status === 'done' ? 'todo' : 'done', completedAt: task.status !== 'done' ? new Date().toISOString() : undefined });
        }}
        className={`w-4 h-4 rounded border-2 flex-shrink-0 transition-colors ${
          task.status === 'done' ? 'border-emerald-500 bg-emerald-500/20' : 'border-white/20 hover:border-brand-400'
        }`}
      >
        {task.status === 'done' && <span className="block w-full h-full text-emerald-400 text-[8px] flex items-center justify-center">✓</span>}
      </button>
      <span className={`flex-1 min-w-0 text-sm truncate ${task.status === 'done' ? 'line-through text-white/30' : 'text-white/80 group-hover:text-white'}`}>
        {task.title}
      </span>
      {task.recurring && task.status !== 'done' && <span className="flex-shrink-0 text-xs text-white/25" title={`Repeats ${task.recurring}`}>↻</span>}
      {task.within72Hours && <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 font-medium">72h</span>}
      {task.questionsForLev && <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 font-medium">?</span>}
      <span className={`flex-shrink-0 w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[task.priority]}`} title={task.priority} />
      {showProject && project && (
        <span className="flex-shrink-0 text-xs opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: project.color + 'cc' }}>
          {project.name}
        </span>
      )}
      {task.dueDate && (
        <span className={`flex-shrink-0 text-xs ${isOverdue ? 'text-red-400' : 'text-white/30'}`}>
          {isOverdue && <AlertTriangle size={10} className="inline mr-0.5" />}
          {isToday(new Date(task.dueDate)) ? 'Today' : isTomorrow(new Date(task.dueDate)) ? 'Tomorrow' : format(new Date(task.dueDate), 'MMM d')}
        </span>
      )}
    </div>
  );
}
