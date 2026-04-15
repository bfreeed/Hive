import React, { forwardRef } from 'react';
import { useStore } from '../store';
import { AlertTriangle, GitBranch } from 'lucide-react';
import { format, isPast, isToday, isTomorrow } from 'date-fns';
import type { Task } from '../types';

const PRIORITY_LABEL: Record<string, { text: string; className: string }> = {
  urgent: { text: 'Urgent',  className: 'text-red-400/80'    },
  high:   { text: 'High',    className: 'text-orange-400/80'  },
  medium: { text: 'Medium',  className: 'text-yellow-400/70'  },
  low:    { text: 'Low',     className: 'text-white/25'        },
};

interface TaskRowProps {
  task: Task;
  onOpenTask: (id: string) => void;
  showProject?: boolean;
  focused?: boolean;
}

const TaskRow = forwardRef<HTMLDivElement, TaskRowProps>(function TaskRow({ task, onOpenTask, showProject = false, focused = false }, ref) {
  const { projects, users, tasks, updateTask, currentUser } = useStore();
  const subtaskCount = tasks.filter(t => t.parentId === task.id).length;
  const subtaskDoneCount = tasks.filter(t => t.parentId === task.id && t.status === 'done').length;
  const project = projects.find((p) => p.id === task.projectIds?.[0]);
  const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && task.status !== 'done';
  const assignees = (task.assigneeIds ?? [])
    .map(id => users.find(u => u.id === id) ?? (id === currentUser.id ? currentUser : null))
    .filter(Boolean) as typeof users;

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
      {subtaskCount > 0 && (
        <span className="flex-shrink-0 flex items-center gap-0.5 text-[10px] text-white/30 bg-white/[0.05] px-1.5 py-0.5 rounded-full" title={`${subtaskDoneCount}/${subtaskCount} subtasks`}>
          <GitBranch size={9} />
          {subtaskDoneCount}/{subtaskCount}
        </span>
      )}
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
      {/* Priority */}
      {task.priority && task.priority !== 'low' && (
        <span className={`flex-shrink-0 text-[11px] font-medium ${PRIORITY_LABEL[task.priority]?.className ?? 'text-white/25'}`}>
          {PRIORITY_LABEL[task.priority]?.text}
        </span>
      )}
      {/* Due date */}
      {task.dueDate && (
        <span className={`flex-shrink-0 text-[11px] ${isOverdue ? 'text-red-400' : 'text-white/35'}`}>
          {isOverdue && <AlertTriangle size={10} className="inline mr-0.5" />}
          {isToday(new Date(task.dueDate)) ? 'Today' : isTomorrow(new Date(task.dueDate)) ? 'Tomorrow' : format(new Date(task.dueDate), 'MMM d')}
        </span>
      )}
      {/* Assignees */}
      {assignees.length > 0 && (
        <span className="flex-shrink-0 flex items-center gap-0.5">
          {assignees.slice(0, 2).map(u => (
            <span
              key={u.id}
              className="w-4 h-4 rounded-full bg-brand-600/40 border border-brand-500/30 flex items-center justify-center text-[8px] font-semibold text-brand-300"
              title={u.name}
            >
              {u.name.charAt(0).toUpperCase()}
            </span>
          ))}
          {assignees.length > 2 && <span className="text-[10px] text-white/30">+{assignees.length - 2}</span>}
        </span>
      )}
      {/* Project */}
      {showProject && project && (
        <span className="flex-shrink-0 text-[11px]" style={{ color: project.color + 'bb' }}>
          {project.name}
        </span>
      )}
    </div>
  );
});

export default TaskRow;
