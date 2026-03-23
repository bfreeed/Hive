import React, { forwardRef } from 'react';
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
  focused?: boolean;
}

const TaskRow = forwardRef<HTMLDivElement, TaskRowProps>(function TaskRow({ task, onOpenTask, showProject = false, focused = false }, ref) {
  const { projects, users, updateTask } = useStore();
  const project = projects.find((p) => p.id === task.projectIds?.[0]);
  const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && task.status !== 'done';

  return (
    <div
      ref={ref}
      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer group transition-colors ${focused ? 'bg-white/[0.06] ring-1 ring-brand-500/40' : 'hover:bg-white/[0.04]'}`}
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
      {task.flags?.map(tf => {
        const applier = users.find(u => u.id === tf.appliedBy);
        const flagDef = applier?.flags?.find(f => f.id === tf.flagId);
        if (!flagDef) return null;
        return (
          <span key={`${tf.flagId}-${tf.appliedBy}`} className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: flagDef.color + '1a', color: flagDef.color }}>
            {flagDef.name.length > 8 ? flagDef.name.slice(0, 8) + '…' : flagDef.name}
          </span>
        );
      })}
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
});

export default TaskRow;
