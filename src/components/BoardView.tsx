import React from 'react';
import { useStore } from '../store';
import { isPast, isToday, isTomorrow, format } from 'date-fns';
import type { Task, Priority } from '../types';
import type { TaskGroup } from '../utils/buildGroups';

const PRIORITY_DOT: Record<Priority, string> = {
  urgent: 'bg-red-400', high: 'bg-orange-400', medium: 'bg-yellow-400', low: 'bg-white/20',
};

interface BoardViewProps {
  groups: TaskGroup[];
  onOpenTask: (id: string) => void;
}

export default function BoardView({ groups, onOpenTask }: BoardViewProps) {
  const { updateTask } = useStore();

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
      {groups.map((group) => (
        <div key={group.label || 'all'} className="flex-shrink-0 w-64">
          <div className="flex items-center gap-2 mb-3">
            {group.color && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: group.color }} />}
            <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">{group.label || 'Tasks'}</span>
            <span className="text-xs text-white/30">{group.tasks.length}</span>
          </div>
          <div className="space-y-2">
            {group.tasks.map((task) => (
              <div
                key={task.id}
                onClick={() => onOpenTask(task.id)}
                className="bg-white/[0.04] rounded-xl p-3 border border-white/[0.06] hover:border-white/10 cursor-pointer transition-colors"
              >
                <div className="flex items-start gap-2 mb-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateTask(task.id, {
                        status: task.status === 'done' ? 'todo' : 'done',
                        completedAt: task.status !== 'done' ? new Date().toISOString() : undefined,
                      });
                    }}
                    className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 transition-colors ${
                      task.status === 'done' ? 'border-emerald-500 bg-emerald-500/20' : 'border-white/20 hover:border-brand-400'
                    }`}
                  >
                    {task.status === 'done' && (
                      <span className="block w-full h-full text-emerald-400 text-[8px] flex items-center justify-center">✓</span>
                    )}
                  </button>
                  <p className={`text-sm flex-1 leading-snug ${task.status === 'done' ? 'line-through text-white/30' : 'text-white/80'}`}>
                    {task.title}
                  </p>
                </div>
                <div className="flex items-center gap-2 pl-6">
                  <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[task.priority]}`} />
                  <span className="text-xs text-white/30 capitalize">{task.priority}</span>
                  {task.dueDate && (() => {
                    const d = new Date(task.dueDate);
                    const overdue = isPast(d) && task.status !== 'done';
                    return (
                      <span className={`text-xs ml-auto ${overdue ? 'text-red-400' : 'text-white/50'}`}>
                        {isToday(d) ? 'Today' : isTomorrow(d) ? 'Tomorrow' : format(d, 'MMM d')}
                      </span>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
